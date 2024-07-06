const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const path = require('path');
var cron = require('node-cron');
app.use(bodyParser.json());

require('dotenv').config(); 
app.use(express.static(path.join(__dirname, 'views')));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
const mongoose = require('mongoose');
const uri=process.env.URI;
const session = require('express-session');
app.use(session({
    secret: 'your_secret_key', 
    resave: false,
    saveUninitialized: false
}));
// app.use("/api", authRouter);
mongoose.connect(uri)//, { useNewUrlParser: true, useUnifiedTopology: true }
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));   
const reminderSchema = new mongoose.Schema({
        id:Number,
        name: String,
        dueDate: Date,
        cost: Number,
        category: String, 
        recurring: Boolean, 
        customNotification: String
    });
const reminderSchema1=new mongoose.Schema({
    name:{
        type:String,
        require:true  },
        
    password: {
        type:String,
        require:true
    },
    
    email:{
        type:String,
       require:true }, 
       
       fullName:
     {
        type:String,
      require:true
    }

})
const Reminder = mongoose.model('Reminder', reminderSchema);
const Reminder1 = mongoose.model('signup', reminderSchema1);
let reminders = [
    { id: 1, name: 'Rent', dueDate: '2024-05-01', cost: 100, category: 'Rent' },
    { id: 2, name: 'Electricity bill', dueDate: '2024-05-05', cost: 50, category: 'Utilities' },
];
app.get('/', (req, res) => {
    res.render('index', { reminders: reminders });
});
app.get('/login',(req,res)=>{
    res.render('login');
})
app.get('/new', (req, res) => {
    res.render('new');
});
app.get('/signup',(req,res)=>{
    res.render('signup');
})
app.get('/profile',(req,res)=>
{
    res.render('profile',{reminders:reminders,username:req.session.username});
})
app.delete('/delete/:id', (req, res) => {
    const idToDelete = parseInt(req.params.id);
    reminders = reminders.filter(reminder => reminder.id !== idToDelete);
     res.redirect('/');
});

app.get('/print', (req, res) => {
    const doc = new PDFDocument();
    const buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=bills.pdf');
        res.send(pdfData);
    });
    doc.fontSize(20).text('Payment Reminders', { align: 'center' });
    doc.moveDown();
    reminders.forEach((reminder, index) => {
        doc.fontSize(14).text(`Name: ${reminder.name}`);
        doc.fontSize(12).text(`Due Date: ${reminder.dueDate}`);
        doc.fontSize(12).text(`Cost: Rs.${reminder.cost.toFixed(2)}`);
        doc.fontSize(12).text(`Category: ${reminder.category}`);
        doc.moveDown();
        if (index !== reminders.length - 1) {
            doc.addPage();
        }
    });

    doc.end();
});
app.get('/reminders', (req, res) => {
    const { sortBy, filterBy } = req.query;
    let sortedReminders = reminders;
    if (sortBy === 'name') 
    {
        sortedReminders = sortedReminders.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'dueDate') {
        sortedReminders = sortedReminders.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    } else if (sortBy === 'category') {
        sortedReminders = sortedReminders.sort((a, b) => a.category.localeCompare(b.category));
    }
    // Filter reminders by specified category
    let filteredReminders = sortedReminders;
    if (filterBy) {
        filteredReminders = sortedReminders.filter(reminder => reminder.category === filterBy);
    }
    res.render('profile', { reminders: filteredReminders ,username:req.session.username});
});
app.get('/reminder/:id', (req, res) => 
    {
    const reminderId = parseInt(req.params.id);
    const reminder = reminders.find(reminder => reminder.id === reminderId);
    if (reminder) {
        res.render('reminder_details', { reminder });
    } else {
        res.status(404).send('Reminder not found');
    }
});
app.post('/reminder/recurring', (req, res) => {
    let newReminder = {
        id: reminders.length + 1,
        name: req.body.name,
        dueDate: req.body.dueDate,
        cost: parseFloat(req.body.cost),
        category: req.body.category,
        recurring: req.body.recurring === 'on'
    };
    reminders.push(newReminder);
    res.redirect('/profile');
    let emailSent = false;
    
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        auth: {
            user: 'gmail',
            pass: 'pass'
        }
    });

    const mailOptions ={
        from: 'gmail',
        to: 'gmail',
        subject: 'Payment Reminder',
        text: `Dear user,\nThis is a reminder that your payment is due  Details are:\n
        \nName:${newReminder.name}\nDue Date:${newReminder.dueDate}\nCost:${newReminder.cost}\nCategory:${newReminder.category}\nRecurring:${newReminder.recurring}\n\n Kindly Open your app and check it .\n\nThank you.`
        
    };

    const sendMail = async (transporter, mailOptions) => {
        try {
            await transporter.sendMail(mailOptions);
        } catch (error) {
            console.log(error);
        }
    }

const sendEmailOnce = () => {
    if (!emailSent) {
        sendMail(transporter, mailOptions);
        emailSent = true; 
    }
};
const [year, month, day] = newReminder.dueDate.split('-').map(Number);
    cron.schedule(`* * * ${day} ${month} * `, () => {
       
                sendEmailOnce();
            });
            emailSent=false;
            
            Reminder.insertMany([newReminder]);
});

app.post('/signup', async (req, res) => {
    try {
        const password=req.body.password;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser={ 
            name:req.body.username, 
            email:req.body.email,
            password:hashedPassword, 
            fullName:req.body.fullName
        } 
        // Create new user
        await  Reminder1.insertMany([newUser]);
        res.redirect('/login');
    }
     catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send('Internal Server Error');
    }
});
// Login route
const bcrypt = require('bcrypt');  
app.post('/login', async (req, res) => {
    try {
        const name=req.body.username;
        const password=req.body.password;
      
        const user = await Reminder1.findOne({ name });
        if (user) {
            const passwordMatch=await bcrypt.compare(password,user.password)
            if (passwordMatch) 
                {
                req.session.username = name;
                res.redirect('/profile');
            } 
            else {
             
                res.render('login', { errorMessage: 'Invalid password' });
            }
        } 
        else {
          
           res.render('login', { errorMessage: 'Invalid username' });
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/profile');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});
// User profile route
app.get('/profile', (req, res) => {
    const user = req.session.user;
    if (user) {
        res.json(user);
    } else {
        res.status(401).send('Unauthorized');
    }
});

// Update user profile route
app.put('/profile', async (req, res) => {
    try {
        const user = req.session.user;
        if (user) {
            const { name, email, notificationPreferences } = req.body;
            user.name = name;
            user.email = email;
            user.notificationPreferences = notificationPreferences;
            await user.save();
            res.send('Profile updated successfully');
        } else {
            res.status(401).send('Unauthorized');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send('Internal Server Error');
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Payment Reminder App is running on port ${PORT}`);
});

