const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'חובה להזין שם משתמש'],
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'חובה להזין סיסמה'],
        minlength: [6, 'הסיסמה חייבת להכיל לפחות 6 תווים']
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);