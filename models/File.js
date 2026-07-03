const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'חובה לספק מזהה משתמש userId']
    },
    fileName: {
        type: String,
        required: [true, 'חובה להזין את שם הקובץ'],
        trim: true
    },
    fileType: {
        type: String,
        required: true,
        enum: ['image', 'video', 'audio', 'document', 'other'] 
    },
    fileSizeKB: {
        type: Number,
        required: true
    },
    fileData: {
        type: String,
        required: [true, 'חובה לספק את תוכן הקובץ']
    }
}, { timestamps: true });

module.exports = mongoose.model('File', fileSchema);