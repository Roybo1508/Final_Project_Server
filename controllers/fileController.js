const mongoose = require('mongoose');
const File = require('../models/File');

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