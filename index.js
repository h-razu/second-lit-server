const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

const app = express();

//middleware
app.use(cors());
app.use(express.json());


//verify JWT
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    // console.log(token);

    jwt.verify(token, process.env.JWT_KEY, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden" });
        }
        req.decoded = decoded;
        next();
    })
}


//mongodb connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_USER_KEY}@cluster0.tbtpug1.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const userCollection = client.db("secondLit").collection("usersCollection");
        const categoryCollection = client.db("secondLit").collection("category");
        const productCollection = client.db("secondLit").collection("products");
        const bookingCollection = client.db("secondLit").collection("booking");



        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;

            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (user && user.accountType !== "Admin") {
                return res.status(403).send({ message: "Forbidden Access" })
            }
            next()
        }

        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;

            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (user && user.accountType !== "Seller") {
                return res.status(403).send({ message: "Forbidden Access" })
            }
            next()
        }

        //--------------------------------------------------------------USER
        //--01
        //save user with account type
        app.post("/users", async (req, res) => {
            const user = req.body;

            //for google login
            const userEmail = user.email;
            const query = { email: userEmail };
            const isUserExist = await userCollection.findOne(query);
            if (isUserExist) {
                return res.send({ acknowledged: true });
            }
            // console.log(user)
            const result = await userCollection.insertOne(user);

            res.send(result);
        });

        //--02
        //check user account type
        app.get("/users/checkAccountType", verifyJWT, async (req, res) => {

            const email = req.query.email;

            const decodedEmail = req.decoded.email;
            if (email != decodedEmail) {
                return res.status(403).send({ message: "Forbidden" });
            }

            const query = { email: email };

            const user = await userCollection.findOne(query);
            if (user) {
                return res.send({ userAccountType: user.accountType });
            }

            res.status(404).send({ message: "Not Found" });

        })

        //--03
        //get all seller
        app.get("/users/sellers", verifyJWT, verifyAdmin, async (req, res) => {
            const filter = { accountType: "Seller" };

            const result = await userCollection.find(filter).toArray();

            res.send(result);
        })

        //--04
        //delete seller
        app.delete("/users/sellers/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await userCollection.deleteOne(filter);

            res.send(result);
        })

        //--05
        //verify seller
        app.put("/users/sellers/:id", verifyJWT, verifyAdmin, async (req, res) => {

            const id = req.params.id;

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };

            const updateDoc = {
                $set: {
                    verified: true
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc, options);

            res.send(result);
        });


        //--06
        //get all buyer
        app.get("/users/buyers", verifyJWT, verifyAdmin, async (req, res) => {
            const filter = { accountType: "Buyer" };

            const result = await userCollection.find(filter).toArray();

            res.send(result);
        })

        //--07
        //delete buyers
        app.delete("/users/buyers/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await userCollection.deleteOne(filter);

            res.send(result);
        });

        //----------------------------------------------------------JWT
        app.get("/jwt", async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);

            //issue token
            if (user) {
                const token = jwt.sign({ email }, process.env.JWT_KEY, { expiresIn: "1h" });
                return res.send({ accessToken: token });
            }

            res.send({ accessToken: "" });
        });

        //-------------------------------------------------------------category
        //--01
        //get all category
        app.get("/category", async (req, res) => {
            const result = await categoryCollection.find({}).toArray();
            res.send(result);
        });



        //------------------------------------------------------------PRODUCTS
        //--01
        //add product
        app.post("/products", verifyJWT, verifySeller, async (req, res) => {
            const product = req.body;

            const result = await productCollection.insertOne(product);

            res.send(result);
        });

        //--02
        //get all product
        app.get("/products", async (req, res) => {
            const name = req.query?.name;

            const query = { seller: name };

            const result = await productCollection.find(query).toArray();
            res.send(result);
        });

        //--03
        //delete product
        app.delete("/products/:id", verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(filter);

            res.send(result);
        });

        //--04
        //advertise add
        app.put("/products/:id", verifyJWT, verifySeller, async (req, res) => {

            const id = req.params.id;

            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };

            const updateDoc = {
                $set: {
                    advertised: true
                }
            }
            const result = await productCollection.updateOne(filter, updateDoc, options);

            res.send(result);
        });

        //--05
        //get advertised product
        app.get("/products/advertised", async (req, res) => {
            const filter = { advertised: true };

            const result = await productCollection.find(filter).toArray();

            res.send(result);
        });

        app.get("/products/:categoryName", async (req, res) => {
            const category = req.params.categoryName;

            const filter = { category: category };

            const result = await productCollection.find(filter).toArray();

            res.send(result);
        })

        //----------------------------------------------------------------BOOKING
        app.post("/booking", async (req, res) => {
            const booking = req.body;

            const result = await bookingCollection.insertOne(booking);

            res.send(result);

        })

        app.get("/booking", async (req, res) => {
            const email = req.query.email;

            const filter = { buyerEmail: email };

            const result = await bookingCollection.find(filter).toArray();

            res.send(result);
        })


    } finally {

    }
}


run().catch(err => console.log(err));


app.get('/', (req, res) => {
    res.send("Second Lit Server Running Successfully");
});

app.listen(port, () => {
    console.log(`second lit server running on port ${port}`);
});
