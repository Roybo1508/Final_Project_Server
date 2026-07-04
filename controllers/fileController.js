const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Resend } = require('resend');
const File = require('../models/File');
const ShareLink = require('../models/ShareLink');

function getResendClient() {
    return new Resend(process.env.RESEND_API_KEY);
}

const TOTAL_QUOTA_KB = 102400;
const MAX_FILE_SIZE_KB = 2048;

async function getUsedStorageKB(userId) {
    const result = await File.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: null, totalUsedKB: { $sum: '$fileSizeKB' } } }
    ]);
    return result.length > 0 ? result[0].totalUsedKB : 0;
}

exports.getUserFiles = async (req, res) => {
    try {
        const { userId, search, fileType, sortBy, order, includeData } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, message: "חובה לספק userId בשאילתה" });
        }

        const query = { userId };

        if (search) {
            query.fileName = { $regex: search, $options: 'i' };
        }

        if (fileType) {
            query.fileType = fileType;
        }

        const allowedSortFields = ['fileName', 'fileSizeKB', 'createdAt'];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const sortOrder = order === 'asc' ? 1 : -1;

        const projection = includeData === 'true' ? {} : { fileData: 0 };
        const files = await File.find(query, projection).sort({ [sortField]: sortOrder });

        res.status(200).json({
            success: true,
            count: files.length,
            files
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getFilesWithOwner = async (req, res) => {
    try {
        const files = await File.find({}, { fileData: 0 })
            .populate('userId', 'username email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: files.length,
            files
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.downloadFile = async (req, res) => {
    const { id } = req.params;
    try {
        const file = await File.findById(id);

        if (!file) {
            return res.status(404).json({ success: false, message: "הקובץ לא נמצא" });
        }

        res.status(200).json({
            success: true,
            fileName: file.fileName,
            fileType: file.fileType,
            fileData: file.fileData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.uploadFile = async (req, res) => {
    try {
        const { userId, fileName, fileType, fileSizeKB, fileData } = req.body;

        if (fileSizeKB > MAX_FILE_SIZE_KB) {
            return res.status(400).json({
                success: false,
                message: `הקובץ גדול מדי. הגודל המרבי לקובץ הוא ${MAX_FILE_SIZE_KB / 1024} MB`
            });
        }

        const usedKB = await getUsedStorageKB(userId);
        if (usedKB + fileSizeKB > TOTAL_QUOTA_KB) {
            return res.status(400).json({
                success: false,
                message: "אין מספיק מקום אחסון פנוי בענן שלכם"
            });
        }

        const newFile = new File({
            userId,
            fileName,
            fileType,
            fileSizeKB,
            fileData
        });

        await newFile.save();

        res.status(201).json({
            success: true,
            message: "הקובץ הועלה ונשמר בהצלחה בענן שלכם!",
            file: {
                _id: newFile._id,
                userId: newFile.userId,
                fileName: newFile.fileName,
                fileType: newFile.fileType,
                fileSizeKB: newFile.fileSizeKB,
                createdAt: newFile.createdAt
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.renameFile = async (req, res) => {
    const { id } = req.params;
    const { newName } = req.body;
    try {
        const updatedFile = await File.findByIdAndUpdate(
            id,
            { fileName: newName },
            { new: true, runValidators: true }
        );

        if (!updatedFile) {
            return res.status(404).json({ success: false, message: "הקובץ לא נמצא בדטבייס" });
        }

        res.status(200).json({ success: true, message: "שם הקובץ עודכן בהצלחה", file: updatedFile });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteFile = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedFile = await File.findByIdAndDelete(id);

        if (!deletedFile) {
            return res.status(404).json({ success: false, message: "הקובץ לא נמצא או שכבר נמחק" });
        }

        res.status(200).json({ success: true, message: "הקובץ נמחק בהצלחה מהענן." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStorageSummary = async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ success: false, message: "חובה לספק userId בשאילתה" });
        }

        const totalUsedKB = await getUsedStorageKB(userId);
        const remainingKB = Math.max(0, TOTAL_QUOTA_KB - totalUsedKB);
        res.status(200).json({
            success: true,
            totalUsedKB,
            remainingKB,
            totalQuotaKB: TOTAL_QUOTA_KB
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.shareFileViaEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { recipientEmail, password, expirationDays, senderName } = req.body;

        if (!recipientEmail) {
            return res.status(400).json({ success: false, message: "Email recipient is required" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            return res.status(400).json({ success: false, message: "Invalid email format" });
        }

        const file = await File.findById(id);
        if (!file) {
            return res.status(404).json({ success: false, message: "File not found" });
        }

        const token = crypto.randomBytes(32).toString('hex');

        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        let expirationDate = null;
        if (expirationDays) {
            expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + parseInt(expirationDays));
        }

        const shareLink = new ShareLink({
            fileId: id,
            token,
            recipientEmail,
            password: hashedPassword,
            expirationDate
        });

        await shareLink.save();

        const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
        const shareUrl = `${baseUrl}/api/files/share/${token}`;

        try {
            const resend = getResendClient();
            const emailResponse = await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || 'MyCloud <onboarding@resend.dev>',
                to: recipientEmail,
                subject: `${senderName || 'Someone'} shared "${file.fileName}" with you via MyCloud`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #333;">📁 ${senderName || 'Someone'} shared a file with you</h2>
                        <p style="color: #666;">A file has been shared with you via MyCloud.</p>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>File:</strong> ${file.fileName}</p>
                            <p style="margin: 5px 0;"><strong>Size:</strong> ${(file.fileSizeKB / 1024).toFixed(2)} MB</p>
                            ${expirationDate ? `<p style="margin: 5px 0;"><strong>Expires:</strong> ${expirationDate.toLocaleDateString()}</p>` : ''}
                            ${password ? '<p style="margin: 5px 0;"><strong>🔒 Password Protected</strong></p>' : ''}
                        </div>
                        <p style="margin-top: 30px;">
                            <a href="${shareUrl}" style="background-color: #3b7ef4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                                Download File
                            </a>
                        </p>
                        <p style="margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
                            This is an automated message from MyCloud. Do not reply to this email.
                        </p>
                    </div>
                `
            });

            if (!emailResponse.data?.id) {
                console.error('Resend error:', emailResponse.error);
                return res.status(500).json({
                    success: false,
                    message: "File share created but email failed to send. Share link: " + shareUrl
                });
            }
        } catch (emailError) {
            console.error('Email service error:', emailError.message);
            return res.status(500).json({
                success: false,
                message: "File share created but email failed to send. Share link: " + shareUrl
            });
        }

        res.status(201).json({
            success: true,
            message: `File shared successfully! Email sent to ${recipientEmail}`,
            shareToken: token,
            shareUrl
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.downloadFileByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body || {};

        const shareLink = await ShareLink.findOne({ token });

        if (!shareLink) {
            return res.status(404).json({ success: false, message: "Share link not found or expired" });
        }

        if (shareLink.expirationDate && new Date() > shareLink.expirationDate) {
            return res.status(404).json({ success: false, message: "Share link has expired" });
        }

        if (shareLink.password) {
            if (!password) {
                return res.status(401).json({ success: false, message: "Password required", requiresPassword: true });
            }

            const passwordMatch = await bcrypt.compare(password, shareLink.password);
            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: "Incorrect password" });
            }
        }

        const file = await File.findById(shareLink.fileId);
        if (!file) {
            return res.status(404).json({ success: false, message: "File no longer exists" });
        }

        res.status(200).json({
            success: true,
            fileName: file.fileName,
            fileType: file.fileType,
            fileData: file.fileData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};