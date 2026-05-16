require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const { Pool } = require('pg');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Koneksi PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

// Serve frontend
app.use(express.static('.'));

// Endpoint submit
app.post('/submit', upload.single('berkas'), async (req, res) => {
  try {
    const { nama, email } = req.body;
    const file = req.file;

    // 1. Upload ke Azure Blob Storage
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_CONTAINER_NAME
    );
    const blobName = `${Date.now()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype }
    });
    const ktpUrl = blockBlobClient.url;

    // 2. Simpan ke PostgreSQL
    await pool.query(
      'INSERT INTO pelamar (nama, email, ktp_url) VALUES ($1, $2, $3)',
      [nama, email, ktpUrl]
    );

    res.json({ success: true, message: 'Pendaftaran berhasil!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(3000, () => console.log('Server berjalan di http://localhost:3000'));