const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); // ObjectId will be useful

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eyxn1x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    console.log("Successfully connected to MongoDB!"); // Updated log

    // Define database and collections
    const database = client.db("gigConnectDB"); // You can name your database
    const tasksCollection = database.collection("tasks");
    const bidsCollection = database.collection("bids");
    // Potentially a usersCollection if you store additional user profile info beyond Firebase Auth
    // const usersCollection = database.collection("users");

    // Make collections accessible to routes by attaching to app.locals
    app.locals.tasksCollection = tasksCollection;
    app.locals.bidsCollection = bidsCollection;
    // app.locals.usersCollection = usersCollection;

    // Basic route to confirm server is running
    app.get('/', (req, res) => {
      res.send('GigConnect Server is running and connected to DB!');
    });

    // --- Task API Endpoints ---

    // POST a new task
    app.post('/api/v1/tasks', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      try {
        // console.log('Received request body for POST /api/v1/tasks:', req.body); // Diagnostic log removed or keep if needed for debugging
        const taskData = req.body;
        // Basic validation (can be expanded later)
        if (!taskData) { // More specific check if req.body wasn't parsed
          return res.status(400).send({ message: 'Request body is missing or not in JSON format. Ensure Content-Type is application/json.' });
        }
        if (!taskData.title || !taskData.category || !taskData.budget || !taskData.deadline || !taskData.description || !taskData.creatorEmail) {
          return res.status(400).send({ message: 'Missing required task fields.' });
        }
        // Add a timestamp for when the task was created
        taskData.createdAt = new Date();

        const result = await tasksCollection.insertOne(taskData);
        res.status(201).send({ message: 'Task created successfully', taskId: result.insertedId });
      } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).send({ message: 'Failed to create task', error: error.message });
      }
    });

    // GET all tasks
    app.get('/api/v1/tasks', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      try {
        const tasks = await tasksCollection.find({}).sort({ deadline: 1 }).toArray(); // Sort by deadline, soonest first
        res.status(200).send(tasks);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).send({ message: 'Failed to fetch tasks', error: error.message });
      }
    });

    // GET featured tasks (top 6 by soonest deadline)
    app.get('/api/v1/featured-tasks', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      try {
        const featuredTasks = await tasksCollection.find({})
                                              .sort({ deadline: 1 }) // Sort by deadline, soonest first
                                              .limit(6) // Limit to 6 tasks
                                              .toArray();
        res.status(200).send(featuredTasks);
      } catch (error) {
        console.error('Error fetching featured tasks:', error);
        res.status(500).send({ message: 'Failed to fetch featured tasks', error: error.message });
      }
    });

    // GET a single task by ID
    app.get('/api/v1/tasks/:id', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      const { id } = req.params;
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid Task ID format.' });
        }
        const task = await tasksCollection.findOne({ _id: new ObjectId(id) });
        if (!task) {
          return res.status(404).send({ message: 'Task not found.' });
        }
        res.status(200).send(task);
      } catch (error) {
        console.error('Error fetching task by ID:', error);
        res.status(500).send({ message: 'Failed to fetch task', error: error.message });
      }
    });

    // PUT (update) a task by ID
    app.put('/api/v1/tasks/:id', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      const { id } = req.params;
      // Create a shallow copy of req.body to safely modify
      const updatePayload = { ...req.body };


      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid Task ID format.' });
        }
        if (Object.keys(updatePayload).length === 0) { // Check the copy
            return res.status(400).send({ message: 'Request body is empty. No update data provided.' });
        }

        // Remove _id from updatePayload if present, as it shouldn't be updated
        delete updatePayload._id;

        // Prevent creatorEmail (and creatorName if it existed) from being updated
        if (updatePayload.hasOwnProperty('creatorEmail')) {
          delete updatePayload.creatorEmail; // Delete from the copy
        }
        // Add a timestamp for the update
        updatePayload.updatedAt = new Date();

        const result = await tasksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatePayload } // Use the modified copy
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Task not found.' });
        }
        if (result.modifiedCount === 0 && result.matchedCount === 1) {
            return res.status(200).send({ message: 'Task found but no changes were applied (data might be the same).', modifiedCount: 0 });
        }
        res.status(200).send({ message: 'Task updated successfully', modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).send({ message: 'Failed to update task', error: error.message });
      }
    });

    // DELETE a task by ID
    app.delete('/api/v1/tasks/:id', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      const { id } = req.params;
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid Task ID format.' });
        }
        const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Task not found.' });
        }
        res.status(200).send({ message: 'Task deleted successfully.' }); // Or 204 No Content
      } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).send({ message: 'Failed to delete task', error: error.message });
      }
    });

    // GET all tasks posted by a specific user
    app.get('/api/v1/my-posted-tasks', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      const { creatorEmail } = req.query; // Expecting email as a query parameter

      if (!creatorEmail) {
        return res.status(400).send({ message: 'creatorEmail query parameter is required.' });
      }

      try {
        const postedTasks = await tasksCollection.find({ creatorEmail: creatorEmail })
                                              .sort({ createdAt: -1 }) // Show newest first
                                              .toArray();
        res.status(200).send(postedTasks);
      } catch (error) {
        console.error('Error fetching posted tasks:', error);
        res.status(500).send({ message: 'Failed to fetch posted tasks', error: error.message });
      }
    });

    // --- Bid API Endpoints ---

    // POST a new bid on a specific task
    app.post('/api/v1/tasks/:taskId/bids', async (req, res) => {
      const { tasksCollection, bidsCollection } = req.app.locals;
      const { taskId } = req.params;
      const bidData = req.body; // Expected: { biddingAmount, bidderEmail, (optional) bidderDeadline, (optional) comment }

      try {
        if (!ObjectId.isValid(taskId)) {
          return res.status(400).send({ message: 'Invalid Task ID format.' });
        }

        // Check if the task exists
        const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) });
        if (!task) {
          return res.status(404).send({ message: 'Task not found. Cannot place bid.' });
        }

        // Validation: User cannot bid on their own task
        if (task.creatorEmail === bidData.bidderEmail) {
          return res.status(403).send({ message: 'You cannot bid on your own task.' });
        }

        // Validation: Deadline for bidding has not passed (using task's deadline)
        const now = new Date();
        const taskDeadline = new Date(task.deadline); // Assuming task.deadline is a valid date string
        if (now > taskDeadline) {
          return res.status(403).send({ message: 'The deadline for bidding on this task has passed.' });
        }

        // Basic validation for bid data
        if (!bidData.biddingAmount || !bidData.bidderEmail ) {
          return res.status(400).send({ message: 'Missing required bid fields (biddingAmount, bidderEmail).' });
        }

        const newBid = {
          taskId: new ObjectId(taskId),
          bidderEmail: bidData.bidderEmail,
          biddingAmount: parseFloat(bidData.biddingAmount),
          bidderDeadline: bidData.bidderDeadline, // Optional: freelancer's proposed deadline
          comment: bidData.comment, // Optional
          status: 'pending', // Default status
          bidPlacedAt: new Date()
        };

        const result = await bidsCollection.insertOne(newBid);
        res.status(201).send({ message: 'Bid placed successfully', bidId: result.insertedId });

      } catch (error) {
        console.error('Error placing bid:', error);
        res.status(500).send({ message: 'Failed to place bid', error: error.message });
      }
    });

    // GET all bids for a specific task
    app.get('/api/v1/tasks/:taskId/bids', async (req, res) => {
      const { bidsCollection } = req.app.locals;
      const { taskId } = req.params;
      try {
        if (!ObjectId.isValid(taskId)) {
          return res.status(400).send({ message: 'Invalid Task ID format.' });
        }

        const bids = await bidsCollection.find({ taskId: new ObjectId(taskId) }).sort({ bidPlacedAt: -1 }).toArray(); // Sort by newest bid first

        if (!bids || bids.length === 0) {
          return res.status(200).send([]); // Send empty array if no bids, still a success
        }
        res.status(200).send(bids);
      } catch (error) {
        console.error('Error fetching bids for task:', error);
        res.status(500).send({ message: 'Failed to fetch bids', error: error.message });
      }
    });

    // GET all bids made by a specific user (bidder)
    app.get('/api/v1/my-bids', async (req, res) => {
      const { bidsCollection } = req.app.locals;
      const bidderEmail = req.query.bidderEmail;

      if (!bidderEmail) {
        return res.status(400).send({ message: 'bidderEmail query parameter is required.' });
      }

      try {
        // Find all bids where the bidderEmail matches
        const myBids = await bidsCollection.find({ bidderEmail: bidderEmail }).sort({ bidPlacedAt: -1 }).toArray(); // Sort by newest bid first

        // Send the array of bids (could be empty)
        res.status(200).send(myBids);

      } catch (error) {
        console.error('Error fetching bids for bidder:', error);
        res.status(500).send({ message: 'Failed to fetch bids', error: error.message });
      }
    });

    // Start the server only after a successful DB connection
    app.listen(port, () => {
      console.log(`GigConnect server is listening on port ${port}`);
    });

  } finally {
    // Ensures that the client will close when you finish/error
    // For a long-running server, you typically don't close the client here.
    // It will close when the Node.js process terminates.
    // await client.close();
  }
}
run().catch(console.dir);
