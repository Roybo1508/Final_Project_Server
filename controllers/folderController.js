const mongoose = require('mongoose');
const Folder = require('../models/Folder');
const File = require('../models/File');

exports.getUserFolders = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        const folders = await Folder.find({ userId }).sort({ createdAt: -1 });

        // Add item counts for each folder
        const foldersWithCounts = await Promise.all(
            folders.map(async (folder) => {
                const fileCount = await File.countDocuments({ folderId: folder._id });
                const subfolderCount = await Folder.countDocuments({ parentFolderId: folder._id });
                return {
                    _id: folder._id,
                    folderName: folder.folderName,
                    parentFolderId: folder.parentFolderId,
                    createdAt: folder.createdAt,
                    itemCount: fileCount + subfolderCount
                };
            })
        );

        res.status(200).json({
            success: true,
            folders: foldersWithCounts
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getFolderContents = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        const folder = await Folder.findById(id);

        if (!folder || folder.userId.toString() !== userId) {
            return res.status(404).json({ success: false, message: "Folder not found" });
        }

        // Get direct subfolders
        const subfolders = await Folder.find({ parentFolderId: id }).sort({ createdAt: -1 });

        // Add item counts to subfolders
        const subfoldersWithCounts = await Promise.all(
            subfolders.map(async (subfolder) => {
                const fileCount = await File.countDocuments({ folderId: subfolder._id });
                const subfolderCount = await Folder.countDocuments({ parentFolderId: subfolder._id });
                return {
                    _id: subfolder._id,
                    folderName: subfolder.folderName,
                    parentFolderId: subfolder.parentFolderId,
                    createdAt: subfolder.createdAt,
                    itemCount: fileCount + subfolderCount
                };
            })
        );

        // Get files in this folder
        const files = await File.find({ folderId: id }, { fileData: 0 }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            folder: {
                _id: folder._id,
                folderName: folder.folderName,
                parentFolderId: folder.parentFolderId
            },
            subfolders: subfoldersWithCounts,
            files: files
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createFolder = async (req, res) => {
    try {
        const { userId, folderName, parentFolderId } = req.body;

        if (!userId || !folderName) {
            return res.status(400).json({ success: false, message: "userId and folderName are required" });
        }

        // If parentFolderId is provided, validate it belongs to the user
        if (parentFolderId) {
            const parentFolder = await Folder.findById(parentFolderId);
            if (!parentFolder || parentFolder.userId.toString() !== userId) {
                return res.status(403).json({ success: false, message: "Parent folder not found or unauthorized" });
            }
        }

        const newFolder = new Folder({
            userId,
            folderName: folderName.trim(),
            parentFolderId: parentFolderId || null
        });

        await newFolder.save();

        res.status(201).json({
            success: true,
            message: "Folder created successfully",
            folder: newFolder
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.renameFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, folderName } = req.body;

        if (!userId || !folderName) {
            return res.status(400).json({ success: false, message: "userId and folderName are required" });
        }

        const folder = await Folder.findById(id);

        if (!folder || folder.userId.toString() !== userId) {
            return res.status(404).json({ success: false, message: "Folder not found or unauthorized" });
        }

        folder.folderName = folderName.trim();
        await folder.save();

        res.status(200).json({
            success: true,
            message: "Folder renamed successfully",
            folder: folder
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        const folder = await Folder.findById(id);

        if (!folder || folder.userId.toString() !== userId) {
            return res.status(404).json({ success: false, message: "Folder not found or unauthorized" });
        }

        // Recursive delete: delete all subfolders and files
        await deleteFolderRecursive(id);

        res.status(200).json({
            success: true,
            message: "Folder deleted successfully"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

async function deleteFolderRecursive(folderId) {
    // Get all subfolders
    const subfolders = await Folder.find({ parentFolderId: folderId });

    // Recursively delete subfolders
    for (const subfolder of subfolders) {
        await deleteFolderRecursive(subfolder._id);
    }

    // Delete all files in this folder
    await File.deleteMany({ folderId: folderId });

    // Delete the folder itself
    await Folder.findByIdAndDelete(folderId);
}

exports.moveFileToFolder = async (req, res) => {
    try {
        const { fileId } = req.params;
        const { userId, targetFolderId } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }

        const file = await File.findById(fileId);

        if (!file || file.userId.toString() !== userId) {
            return res.status(404).json({ success: false, message: "File not found or unauthorized" });
        }

        // Validate target folder if provided (not null/undefined)
        if (targetFolderId && targetFolderId !== 'null') {
            const targetFolder = await Folder.findById(targetFolderId);
            if (!targetFolder || targetFolder.userId.toString() !== userId) {
                return res.status(403).json({ success: false, message: "Target folder not found or unauthorized" });
            }
            file.folderId = targetFolderId;
        } else {
            // Move to root
            file.folderId = null;
        }

        await file.save();

        res.status(200).json({
            success: true,
            message: "File moved successfully",
            file: file
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
