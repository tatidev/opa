# Integrating NetSuite REST API with Node.js + Express

## 📌 Objective
Pull master data records from NetSuite (e.g., Inventory Items, Vendors) using NetSuite's REST API and expose it via your own Node.js Express API for storage in your database.

## ✅ Prerequisites

- NetSuite sandbox account with Token-Based Authentication (TBA) enabled
- Consumer Key / Consumer Secret
- Token ID / Token Secret
- Role with permissions to access REST Web Services
- Node.js and npm installed
- MongoDB, PostgreSQL, or other database to store fetched data

## 📁 Project Structure

    netsuite-api-client/
    ├── .env
    ├── app.js
    ├── routes/
    │   └── netsuite.js
    └── services/
        └── netsuiteClient.js

## 📦 Install Dependencies

    npm init -y
    npm install express dotenv axios oauth-1.0a

**⚠️ Important**: Do NOT install the `crypto` package from npm. Node.js has a built-in `crypto` module that should be used instead. Installing the npm `crypto` package will cause conflicts and authentication failures.

## 🔐 .env Configuration

    NETSUITE_ACCOUNT_ID=11516011-sb1
    CONSUMER_KEY=your_consumer_key
    CONSUMER_SECRET=your_consumer_secret
    TOKEN_ID=your_token_id
    TOKEN_SECRET=your_token_secret

## 🛠️ app.js

    const express = require('express');
    const dotenv = require('dotenv');
    const netsuiteRoutes = require('./routes/netsuite');

    dotenv.config();
    const app = express();
    app.use(express.json());

    app.use('/api/netsuite', netsuiteRoutes);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

## 🛣️ routes/netsuite.js

    const express = require('express');
    const router = express.Router();
    const netsuiteClient = require('../services/netsuiteClient');

    router.get('/vendors', async (req, res) => {
        try {
            const data = await netsuiteClient.getRecord('vendor');
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    module.exports = router;

## 🌐 services/netsuiteClient.js

    const axios = require('axios');
    const OAuth = require('oauth-1.0a');
    const crypto = require('crypto');
    const qs = require('querystring');

    const {
        CONSUMER_KEY,
        CONSUMER_SECRET,
        TOKEN_ID,
        TOKEN_SECRET,
        NETSUITE_ACCOUNT_ID
    } = process.env;

    const oauth = OAuth({
        consumer: { key: CONSUMER_KEY, secret: CONSUMER_SECRET },
        signature_method: 'HMAC-SHA256',
        hash_function(base_string, key) {
            return crypto.createHmac('sha256', key).update(base_string).digest('base64');
        }
    });

    const baseURL = `https://${NETSUITE_ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/record/v1`;

    const getRecord = async (type) => {
        const request_data = {
            url: `${baseURL}/${type}`,
            method: 'GET'
        };

        const authHeader = oauth.toHeader(oauth.authorize(request_data, {
            key: TOKEN_ID,
            secret: TOKEN_SECRET
        }));

        const response = await axios.get(request_data.url, {
            headers: {
                ...authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        return response.data;
    };

    module.exports = { getRecord };

## 🚀 Example Usage

Start the server:

    node app.js

Then visit:

    http://localhost:3000/api/netsuite/vendors

## 🧠 Notes

- You can reuse `getRecord('assemblyItem')`, `getRecord('inventoryItem')`, etc. to retrieve other records.
- Add pagination by reading `links.next.href` from the response and making a new request.
- To store in a database, add logic after `response.data` to upsert into MongoDB or another store.