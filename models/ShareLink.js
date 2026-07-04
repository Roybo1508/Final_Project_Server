const mongoose = require('mongoose');

const shareLinkSchema = new mongoose.Schema({
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
        required: [true, 'File ID is required']
    },
    token: {
        type: String,
        unique: true,
        required: [true, 'Share token is required'],
        trim: true
    },
    recipientEmail: {
        type: String,
        required: [true, 'Recipient email is required'],
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        default: null
    },
    expirationDate: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('ShareLink', shareLinkSchema);
