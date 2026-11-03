import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(express.json());

// Normalize double slashes in incoming request URLs (e.g. //add-studio -> /add-studio)
app.use((req, res, next) => {
  if (req.url && req.url.includes("//")) {
    req.url = req.url.replace(/\/{2,}/g, "/");
  }
  next();
});

const PORT = process.env.PORT || 8000;

const allowedOrigins = [
  "https://studiospace-frontend-theta.vercel.app",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Gracefully allow to avoid blocking valid cross-origin clients
    },
    credentials: true,
  })
);

let cachedClient = null;
let cachedDb = null;

export async function connectToMongoDB() {
  if (cachedDb) {
    return cachedDb;
  }

  const mongoUrl = process.env.MONGODB_URL?.trim();
  if (!mongoUrl) {
    throw new Error(
      "MONGODB_URL environment variable is missing in server environment variables."
    );
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(mongoUrl, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
  }

  await cachedClient.connect();
  cachedDb = cachedClient.db("studiospace");
  console.log("Successfully connected to MongoDB!");
  return cachedDb;
}

async function getCollections() {
  const db = await connectToMongoDB();
  return {
    studioCollection: db.collection("studios"),
    bookingCollection: db.collection("bookings"),
  };
}

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ msg: "Unauthorized! No Authorization header." });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ msg: "Unauthorized! Token missing." });
  }

  const clientUrl = (
    process.env.CLIENT_URL || "https://studiospace-frontend-theta.vercel.app"
  ).replace(/\/+$/, "");

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${clientUrl}/api/auth/jwks`)
    );
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("JWT Verification failed:", error.message);
    return res.status(401).send({ msg: "Unauthorized! Invalid token.", error: error.message });
  }
};

app.post("/add-studio", verifyToken, async (req, res) => {
  try {
    const { studioCollection } = await getCollections();
    const data = req.body;
    const result = await studioCollection.insertOne(data);
    res.status(201).send(result);
  } catch (error) {
    console.error("Error in POST /add-studio:", error);
    res.status(500).send({
      msg: "Failed to add studio.",
      error: error.message,
    });
  }
});

app.get("/studios", async (req, res) => {
  try {
    const { studioCollection } = await getCollections();
    const result = await studioCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Error in GET /studios:", error);
    res.status(500).send({
      msg: "Failed to fetch studios.",
      error: error.message,
    });
  }
});

app.get("/studios/:id", async (req, res) => {
  try {
    const { studioCollection } = await getCollections();
    const id = req.params.id;
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    const result = await studioCollection.findOne(query);
    if (!result) {
      return res.status(404).send({ msg: "Studio not found" });
    }
    res.send(result);
  } catch (error) {
    console.error("Error in GET /studios/:id:", error);
    res.status(400).send({ msg: "Invalid studio ID", error: error.message });
  }
});

app.put("/edit-studio/:id", verifyToken, async (req, res) => {
  try {
    const { studioCollection } = await getCollections();
    const id = req.params.id;
    const { _id, ...updateData } = req.body;
    const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    const result = await studioCollection.updateOne(
      filter,
      { $set: updateData }
    );
    res.send(result);
  } catch (error) {
    console.error("Error in PUT /edit-studio/:id:", error);
    res.status(500).send({ msg: "Failed to update studio", error: error.message });
  }
});

app.post("/bookings", async (req, res) => {
  try {
    const { bookingCollection } = await getCollections();
    const bookingData = {
      ...req.body,
      status: req.body.status || "Pending",
      createdAt: req.body.createdAt || new Date().toISOString(),
    };
    const result = await bookingCollection.insertOne(bookingData);
    res.status(201).send(result);
  } catch (error) {
    console.error("Error in POST /bookings:", error);
    res.status(500).send({ msg: "Failed to create booking", error: error.message });
  }
});

app.get("/bookings", async (req, res) => {
  try {
    const { bookingCollection } = await getCollections();
    const email = req.query.email;
    const query = email ? { userEmail: String(email) } : {};
    const result = await bookingCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  } catch (error) {
    console.error("Error in GET /bookings:", error);
    res.status(500).send({ msg: "Failed to fetch bookings", error: error.message });
  }
});

app.patch("/bookings/:id", async (req, res) => {
  try {
    const { bookingCollection } = await getCollections();
    const id = req.params.id;
    const status = req.body.status || "Cancelled";
    const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    const result = await bookingCollection.updateOne(
      filter,
      {
        $set: {
          status,
          updatedAt: new Date().toISOString(),
        },
      }
    );
    res.send(result);
  } catch (error) {
    console.error("Error in PATCH /bookings/:id:", error);
    res.status(500).send({ msg: "Failed to update booking status", error: error.message });
  }
});

app.put("/bookings/:id", async (req, res) => {
  try {
    const { bookingCollection } = await getCollections();
    const id = req.params.id;
    const status = req.body.status || "Cancelled";
    const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    const result = await bookingCollection.updateOne(
      filter,
      {
        $set: {
          status,
          updatedAt: new Date().toISOString(),
        },
      }
    );
    res.send(result);
  } catch (error) {
    console.error("Error in PUT /bookings/:id:", error);
    res.status(500).send({ msg: "Failed to update booking status", error: error.message });
  }
});

app.get("/", async (req, res) => {
  try {
    await connectToMongoDB();
    res.send({
      message: "StudioSpace Backend is running fine and connected to MongoDB!",
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).send({
      message: "Server is running, but MongoDB connection failed.",
      error: error.message,
      help: "Check MONGODB_URL in Vercel environment variables and ensure MongoDB Atlas Network Access has 0.0.0.0/0 whitelisted.",
    });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
