const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');

router.get('/', fileController.getUserFiles);

router.get('/admin/all', fileController.getFilesWithOwner);

router.get('/storage-summary', fileController.getStorageSummary);

router.post('/upload', fileController.uploadFile);

router.get('/share/:token', fileController.downloadFileByToken);

router.get('/:id/download', fileController.downloadFile);

router.post('/:id/share', fileController.shareFileViaEmail);

router.post('/:fileId/move', fileController.moveFileToFolder);

router.patch('/:id/rename', fileController.renameFile);

router.delete('/:id', fileController.deleteFile);

module.exports = router;