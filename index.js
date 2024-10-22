const express = require('express');
const redis = require('redis');
const { MongoClient } = require('mongodb');
const cookieParser = require('cookie-parser');

const app = express();
const port = 3000;
const redisPort = 6379;
const redisClient = redis.createClient(redisPort);
const mongoURI = 'mongodb://localhost:27017';
const dbName = 'ecommerce';

redisClient.on('error', (err) => {
    console.error('Error connecting to Redis:', err);
});

redisClient.on('connect', () => {
    console.log('Connected to Redis');
});

async function addProductToMongo() {
    const client = new MongoClient(mongoURI);
    const product = [{
        name: 'banana',
        price: 10
    }, {
        name: 'apple',
        price: 20
    }, {
        name: 'orange',
        price: 30
    }];
    try {
        await client.connect();
        const checkproduct = await client.db(dbName).collection('products').find().toArray();
        if (checkproduct.length === 0) {
            const result = await client.db(dbName).collection('products').insertMany(product);
            console.log('Product added to MongoDB:', result);
        }
    } catch (error) {
        console.error('Error adding product to MongoDB:', error);
    } finally {
        await client.close();
    }
}
addProductToMongo();

app.use(express.json());
app.use(cookieParser());

app.post('/register', async (req, res) => {
    const client = new MongoClient(mongoURI);
    try {
        await client.connect();
        const result = await client.db(dbName).collection('users').insertOne(req.body);  // req.body = { username: '...', password: '...' }
        res.send({
            message: 'User registered successfully',
            result: result
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error registering user');
    } finally {
        await client.close();
    }
})

app.post('/login', async (req, res) => {
    const client = new MongoClient(mongoURI);
    try {
        await client.connect();
        const result = await client.db(dbName).collection('users').findOne(req.body); // req.body = { username: '...', password: '...' }
        if (result) {
            res.cookie('redisKey', result.username, { maxAge: 3600000 });
            redisClient.setex(result.username, 3600, 'logged in');
            res.send({
                message: 'User logged in successfully',
                result: result
            });
        } else {
            res.send({
                message: 'Login failed'
            })
        }
    } catch (error) {
        res.status(500).send('Error logging in user');
    } finally {
        await client.close();
    }
})

app.get('/logout', async (req, res) => {
    try {
        const redisKey = req.cookies.redisKey;
        res.clearCookie('redisKey');
        redisClient.del(redisKey, (err, result) => {
            if (err) {
                console.error('Error deleting cache:', err);
            } else {
                console.log('Cache deleted:', result);
            }
        });
        res.send({
            message: 'User logged out successfully'
        });

    } catch (error) {
        res.status(500).send('Error logging out user');
    }
})

app.get('/products', async (req, res) => {
    const client = new MongoClient(mongoURI);
    const redisKey = req.cookies.redisKey || null;
    try {
        if (!redisKey) {
            return res.send({
                message: 'Please login to view products',
            });
        }
        redisClient.get(redisKey, (err, value) => {
            if (err) {
                console.error('Error retrieving cache:', err);
                res.status(500).send(err);
            } else if (!value) {
                res.send({
                    message: 'Please login to view products',
                });
            } else {
                const fetchData = async () => {
                    await client.connect();
                    const products = await client.db(dbName).collection('products').find({}).toArray();
                    res.send(products);
                }
                fetchData();
            }
        });
    } catch (error) {
        res.status(500).send('Error fetching products');
    } finally {
        await client.close();
    }
})

app.get('/products/:search', async (req, res) => {
    const search = req.params.search;
    const client = new MongoClient(mongoURI);
    const redisKey = req.cookies.redisKey || null;
    try {
        if (!redisKey) {
            return res.send({
                message: 'Please login to view products',
            });
        }
        redisClient.get(redisKey, (err, value) => {
            if (err) {
                console.error('Error retrieving cache:', err);
                res.status(500).send(err);
            } else if (!value) {
                res.send({
                    message: 'Please login to view products',
                });
            } else {
                const fetchData = async () => {
                    await client.connect();
                    const products = await client.db(dbName).collection('products').find({ name: search }).toArray();
                    res.send(products);
                }
                fetchData();
            }
        });
    } catch (error) {
        res.status(500).send('Error fetching products');
    } finally {
        await client.close();
    }
})

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
})    