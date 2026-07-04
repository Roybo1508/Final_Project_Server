const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    folderName: {
        type: String,
        required: [true, 'Folder name is required'],
        trim: true
    },
    parentFolderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Folder', folderSchema);
