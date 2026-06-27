const express = require('express');
const app = express();
const fileRoutes = require('./routes/fileRoutes');

app.use(express.json()); 

app.use('/api/files', fileRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`mycloud server is running on port ${PORT}`);
});