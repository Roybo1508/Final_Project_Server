const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getAllUsers, updateUser, deleteUser } = require('../controllers/userController.js');

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/', getAllUsers);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;