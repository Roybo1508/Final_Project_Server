const mongoose = require('mongoose');
const File = require('../models/File');

exports.getUserFiles = async (req, res) => {
    try {
        const { userId, search, fileType, sortBy, order } = req.query;

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

        const files = await File.find(query).sort({ [sortField]: sortOrder });

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
        const files = await File.find()
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

exports.uploadFile = async (req, res) => {
    try {
        const { userId, fileName, fileType, fileSizeKB, fileUrl } = req.body;

        const newFile = new File({
            userId,
            fileName,
            fileType,
            fileSizeKB,
            fileUrl
        });

        await newFile.save();

        res.status(201).json({ 
            success: true, 
            message: "הקובץ הועלה ונשמר בהצלחה בענן שלכם!",
            file: newFile
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

const TOTAL_QUOTA_KB = 102400;
exports.getStorageSummary = async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ success: false, message: "חובה לספק userId בשאילתה" });
        }

        const aggregationResult = await File.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: null, totalUsedKB: { $sum: '$fileSizeKB' } } }
        ]);

        const totalUsedKB = aggregationResult.length > 0 ? aggregationResult[0].totalUsedKB : 0;
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