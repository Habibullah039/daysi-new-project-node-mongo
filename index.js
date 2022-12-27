const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9j8m8ti.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {

    if (err) {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    req.decoded = decoded;
    next();
  })
}




async function run() {

  try {

    await client.connect();
    const appointmentCollection = client.db('DoctorsPortal').collection('doctors-appointment');
    const bookingCollection = client.db('DoctorsPortal').collection('booking');
    const userCollection = client.db('DoctorsPortal').collection('users');
    const doctorCollection = client.db('DoctorsPortal').collection('doctor');


    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requestAccount = await userCollection.findOne({ email: requester });
      if (requestAccount.role === 'admin') {
        next() ;
      }

      else {
        return res.status(403).send({ message: 'Forbidden access' });

      }
    }


    app.get('/services', async (req, res) => {

      const query = {};
      const cursor = appointmentCollection.find(query).project({ name: 1 });
      const services = await cursor.toArray();
      res.send(services);

    })

    app.get('/user', verifyJWT, async (req, res) => {

      const users = await userCollection.find().toArray();
      res.send(users);
    })

    app.get('/doctor', verifyJWT,verifyAdmin, async (req, res) => {

      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    })

    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin });
    })

    

    app.put('/user/admin/:email', verifyJWT, verifyAdmin , async (req, res) => {

      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);  


    })


    app.put('/user/:email', async (req, res) => {

      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };

      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })

      res.send({ result, access_token: token });

    })




    app.get('/available', async (req, res) => {

      const date = req.query.date;

      // step-1

      const services = await appointmentCollection.find().toArray();

      // step-2

      const query = { date: date };
      const booking = await bookingCollection.find(query).toArray();

      // step-3

      services.forEach(service => {

        const serviceBooking = booking.filter(book => book.treatment === service.name);
        const booked = serviceBooking.map(s => s.slot);
        const available = service.slots.filter(s => !booked.includes(s));
        service.slots = available;
      })

      res.send(services);

    });

    

    app.get('/bookings', verifyJWT, async (req, res) => {

      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (decodedEmail === patient) {
        const query = { patient: patient };
        const booking = await bookingCollection.find(query).toArray();
        return res.send(booking);
      }

      else {
        return res.status(403).send({ message: 'Forbidden access' });
      }



    })






    app.post('/booking', async (req, res) => {

      const booking = req.body;
      const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient };
      const exist = await bookingCollection.findOne(query);
      if (exist) {
        return res.send({ success: false, booking: exist })
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result });
    })




    app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {

      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    })


    app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {

      const email = req.params.email;
      const filter = {email : email} ;
      const result = await doctorCollection.deleteOne(filter);
      res.send(result);
    })


  }

  finally {

  }
}

run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Hello Doctor!')
})

app.listen(port, () => {
  console.log(`Doctors app listening on port ${port}`)
})