import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mime from 'mime-types';
import { getDB } from './db.js';
export function ensureDefaultProject() {
  const db = getDB();
  const count = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
  if (count === 0) db.prepare('INSERT INTO projects (name) VALUES (?)').run('Motorbuild');
}
export function listProjects() {
  const db = getDB();
  return db.prepare('SELECT id, name, created_at FROM projects ORDER BY created_at DESC').all();
}
export function createProject(name) {
  const db = getDB();
  const info = db.prepare('INSERT INTO projects (name) VALUES (?)').run(name);
  return db.prepare('SELECT * FROM projects WHERE id=?').get(info.lastInsertRowid);
}
export function listMessages(projectId, beforeId, limit=50) {
  const db = getDB();
  if (beforeId) {
    return db.prepare(`SELECT * FROM messages WHERE project_id=? AND id < ? ORDER BY id DESC LIMIT ?`).all(projectId, beforeId, limit).reverse();
  } else {
    return db.prepare(`SELECT * FROM messages WHERE project_id=? ORDER BY id DESC LIMIT ?`).all(projectId, limit).reverse();
  }
}
export function addMessage(projectId, role, content, attachmentPath) {
  const db = getDB();
  const info = db.prepare(`INSERT INTO messages (project_id, role, content, attachment_path) VALUES (?, ?, ?, ?)`)
    .run(projectId, role, content, attachmentPath);
  return db.prepare('SELECT * FROM messages WHERE id=?').get(info.lastInsertRowid);
}
export function saveAttachment(attachment) {
  const { dataUrl, filename } = attachment;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const attachmentsDir = path.join(__dirname, '..', 'attachments');
  if (!fs.existsSync(attachmentsDir)) fs.mkdirSync(attachmentsDir, { recursive: true });
  const [meta, base64] = dataUrl.split(',');
  const match = /data:(.*?);base64/.exec(meta);
  const mimeType = match ? match[1] : 'application/octet-stream';
  const ext = (mime.lookup(mimeType) && mime.extension(mimeType)) || 'bin';
  const safeName = (filename || 'file').replace(/[^a-z0-9._-]/gi, '_');
  const finalName = safeName.includes('.') ? safeName : `${safeName}.${ext}`;
  const fullPath = path.join(attachmentsDir, Date.now() + '_' + finalName);
  fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
  return fullPath;
}
