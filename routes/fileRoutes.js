const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');

router.get('/', fileController.getUserFiles);

router.get('/admin/all', fileController.getFilesWithOwner);

router.get('/storage-summary', fileController.getStorageSummary);

router.get('/:id/download', fileController.downloadFile);

router.post('/upload', fileController.uploadFile);

router.patch('/:id/rename', fileController.renameFile);

router.delete('/:id', fileController.deleteFile);

module.exports = router;