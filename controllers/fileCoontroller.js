exports.getUserFiles = async (req, res) => {
    try {
        res.status(200).json({ success: true, files: [] });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.uploadFile = async (req, res) => {
    try {
        res.status(201).json({ success: true, message: "הקובץ הועלה בהצלחה לענן!" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.renameFile = async (req, res) => {
    const { id } = req.params;
    const { newName } = req.body;
    try {
        res.status(200).json({ success: true, message: `שם הקובץ עודכן ל-${newName}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteFile = async (req, res) => {
    const { id } = req.params;
    try {
        res.status(200).json({ success: true, message: "הקובץ נמחק בהצלחה מהענן." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};