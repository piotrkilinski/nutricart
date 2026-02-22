const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/stores', require('./routes/stores'));
app.use('/api/products', require('./routes/products'));
app.use('/api/meals', require('./routes/meals'));
app.use('/api/generate', require('./routes/generate'));
app.use('/api/scan', require('./routes/scan'));

app.get('/', (req, res) => res.json({ status: 'NutriCart API dziala' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API dziala na porcie ${PORT}`));
