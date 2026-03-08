const express = require('express')
const multer = require('multer')
const sqlite3 = require('sqlite3').verbose()
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const fs = require('fs')

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

const ADMIN_KEY = "film_2026_nas"

function auth(req, res, next) {
  const key = req.headers["x-key"]
  if (!key || key !== ADMIN_KEY) return res.status(401).json({ code: -1 })
  next()
}

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads')
const db = new sqlite3.Database('db.sqlite')

db.run(`CREATE TABLE IF NOT EXISTS film_roll (
  id TEXT PRIMARY KEY, brand TEXT, model TEXT, iso INTEGER, camera_name TEXT,
  shoot_date TEXT, shoot_location TEXT, develop_date TEXT, develop_lab TEXT,
  scan_device TEXT, notes TEXT, is_deleted INTEGER DEFAULT 0
)`)

db.run(`CREATE TABLE IF NOT EXISTS film_frame (
  id TEXT PRIMARY KEY, roll_id TEXT, frame_number INTEGER, description TEXT,
  shoot_time TEXT, location TEXT, aperture TEXT, shutter TEXT
)`)

db.run(`CREATE TABLE IF NOT EXISTS film_asset (
  id TEXT PRIMARY KEY, roll_id TEXT, frame_id TEXT, type INTEGER,
  url TEXT, name TEXT, bind_id TEXT, created_at INTEGER, is_deleted INTEGER DEFAULT 0
)`)

db.run(`SELECT name FROM sqlite_master WHERE type='table' AND name='film_image'`, (_, r) => {
  if (r) {
    db.all(`SELECT * FROM film_image`, (_, list) => {
      if (!list) return
      list.forEach(img => {
        const fid = uuidv4()
        db.run(`INSERT INTO film_frame(id,roll_id,description) VALUES(?,?,?)`, [fid, img.roll_id, 'migrate'])
        db.run(`INSERT INTO film_asset(id,roll_id,frame_id,type,url,name,bind_id) VALUES(?,?,?,?,?,?,?)`,
          [img.id, img.roll_id, fid, img.type, img.url, img.name, img.bind_id])
      })
    })
    db.run(`ALTER TABLE film_image RENAME TO film_image_old`)
  }
})

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads/'),
  filename: (_, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
})
const upload = multer({ storage })

app.get('/roll/list', auth, (_, res) => {
  db.all(`SELECT * FROM film_roll WHERE is_deleted=0 ORDER BY id DESC`, (_, rows) => res.json(rows))
})

app.post('/roll/add', auth, (req, res) => {
  const id = uuidv4()
  const { brand, model, iso, camera_name, shoot_date, shoot_location, develop_date, develop_lab, scan_device, notes } = req.body
  db.run(`INSERT INTO film_roll VALUES(?,?,?,?,?,?,?,?,?,?,?,0)`,
    [id, brand, model, iso||100, camera_name, shoot_date, shoot_location, develop_date, develop_lab, scan_device, notes],
    () => res.json({ id }))
})

app.post('/roll/del', auth, (req, res) => {
  const { id } = req.body
  db.run(`UPDATE film_roll SET is_deleted=1 WHERE id=?`, [id])
  db.run(`UPDATE film_asset SET is_deleted=1 WHERE roll_id=?`, [id], () => res.json({ ok: 1 }))
})

app.get('/frame/list', auth, (req, res) => {
  db.all(`SELECT * FROM film_frame WHERE roll_id=? ORDER BY frame_number`, [req.query.roll_id], (_, r) => res.json(r))
})

app.get('/asset/list', auth, (req, res) => {
  const { roll_id, type, frame_id } = req.query
  let sql = `SELECT a.*,f.frame_number FROM film_asset a LEFT JOIN film_frame f ON a.frame_id=f.id WHERE a.roll_id=? AND a.is_deleted=0`
  const p = [roll_id]
  if (type) { sql += ` AND a.type=?`; p.push(type) }
  if (frame_id) { sql += ` AND a.frame_id=?`; p.push(frame_id) }
  db.all(sql, p, (_, r) => res.json(r))
})

app.post('/asset/upload', auth, upload.single('file'), (req, res) => {
  const { roll_id, type, frame_number, shoot_time, location } = req.body
  const id = uuidv4()
  const url = 'uploads/' + req.file.filename
  const fn = parseInt(frame_number) || 0

  const getFid = (cb) => {
    if (fn > 0) {
      db.get(`SELECT id FROM film_frame WHERE roll_id=? AND frame_number=?`, [roll_id, fn], (_, f) => {
        if (f) return cb(f.id)
        const fid = uuidv4()
        db.run(`INSERT INTO film_frame(id,roll_id,frame_number,shoot_time,location) VALUES(?,?,?,?,?)`,
          [fid, roll_id, fn, shoot_time, location], () => cb(fid))
      })
    } else {
      const fid = uuidv4()
      db.run(`INSERT INTO film_frame(id,roll_id,description) VALUES(?,?,?)`,
        [fid, roll_id, 'no frame'], () => cb(fid))
    }
  }

  getFid(fid => {
    db.run(`INSERT INTO film_asset(id,roll_id,frame_id,type,url,name,created_at) VALUES(?,?,?,?,?,?,strftime('%s','now'))`,
      [id, roll_id, fid, type, url, req.file.originalname], () => res.json({ id, url }))
  })
})

app.post('/asset/bind', auth, (req, res) => {
  const { from, to } = req.body
  db.run(`UPDATE film_asset SET bind_id=? WHERE id=?`, [to, from])
  db.run(`UPDATE film_asset SET bind_id=? WHERE id=?`, [from, to], () => res.json({ ok: 1 }))
})

app.post('/asset/unbind', auth, (req, res) => {
  const { id } = req.body
  db.run(`UPDATE film_asset SET bind_id='' WHERE id=?`, [id])
  db.run(`UPDATE film_asset SET bind_id='' WHERE bind_id=?`, [id], () => res.json({ ok: 1 }))
})

app.post('/asset/rename', auth, (req, res) => {
  const { id, name } = req.body
  db.run(`UPDATE film_asset SET name=? WHERE id=?`, [name, id], () => res.json({ ok: 1 }))
})

app.post('/asset/del', auth, (req, res) => {
  const { id } = req.body
  db.run(`UPDATE film_asset SET is_deleted=1 WHERE id=?`, [id], () => res.json({ ok: 1 }))
})

app.get('/backup/export', auth, (_, res) => {
  const d = {}
  db.serialize(() => {
    db.all(`SELECT * FROM film_roll WHERE is_deleted=0`, (_, r) => { d.rolls = r
      db.all(`SELECT * FROM film_frame`, (_, r) => { d.frames = r
        db.all(`SELECT * FROM film_asset WHERE is_deleted=0`, (_, r) => { d.assets = r
          res.setHeader('Content-Disposition', 'attachment; filename="backup.json"')
          res.json(d)
        })
      })
    })
  })
})

app.post('/backup/import', auth, (req, res) => {
  const { rolls, frames, assets } = req.body
  if (!rolls || !frames || !assets) return res.json({ ok: 0 })
  db.serialize(() => {
    rolls.forEach(i => db.run(`INSERT OR REPLACE INTO film_roll VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [i.id, i.brand, i.model, i.iso, i.camera_name, i.shoot_date, i.shoot_location,
       i.develop_date, i.develop_lab, i.scan_device, i.notes, i.is_deleted]))
    frames.forEach(i => db.run(`INSERT OR REPLACE INTO film_frame VALUES(?,?,?,?,?,?,?,?)`,
      [i.id, i.roll_id, i.frame_number, i.description, i.shoot_time, i.location, i.aperture, i.shutter]))
    assets.forEach(i => db.run(`INSERT OR REPLACE INTO film_asset VALUES(?,?,?,?,?,?,?,?,?)`,
      [i.id, i.roll_id, i.frame_id, i.type, i.url, i.name, i.bind_id, i.created_at, i.is_deleted]))
  })
  res.json({ ok: 1 })
})

app.listen(3980, '0.0.0.0', () => console.log('run on 3980'))
