const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');

router.get('/', folderController.getUserFolders);

router.get('/:id', folderController.getFolderContents);

router.post('/', folderController.createFolder);

router.patch('/:id', folderController.renameFolder);

router.delete('/:id', folderController.deleteFolder);

module.exports = router;
