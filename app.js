const express = require('express');
const app = express(); //instancier express

//DOTENV
const dotenv = require('dotenv').config();

const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const randToken = require('rand-token');
const nodemailer = require('nodemailer');

//GESTION DES SESSIONS
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

//Models
const User = require("./models/user");
const Reset = require("./models/reset");
const Receipe = require("./models/receipe");
const Favourite = require("./models/favourite");
const Ingredient = require("./models/ingredient");
const Schedule = require("./models/schedule");

//SESSION
app.use(session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: false
  }))

//PASSPORT
app.use(passport.initialize());
app.use(passport.session());

//connexion depuis le cloud
mongoose.connect("mongodb+srv://userOpendev:19858519PaT@cluster0.xxexf.mongodb.net/cooking?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// PASSPORT LOCAL MONGOOSE
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const methodOverride = require('method-override');

//MESSAGE FLASH
const flash = require('connect-flash');
const user = require('./models/user');
const schedule = require('./models/schedule');
app.use(flash());

//METHODE OVERRIDE
//--app.use(methodOverride('X-HTTP-Method-Override'));
// override with POST having ?_method=DELETE
app.use(methodOverride('_method'));

app.use(function(req, res, next){
    //locals equivaut au variable d'envirronement
    res.locals.currentUser = req.user,
    res.locals.error       = req.flash('error'),
    res.locals.success     = req.flash('success')
    next();
})

//EJS
app.set("view engine","ejs");

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

//rendre le contenu public en statique
app.use(express.static("public"));

//route page acceuil
app.get('/',function(req,res){
    //console.log(req.user)
    res.render("index");
});

//route page inscription
app.get("/signup",function(req,res){
    res.render("signup");
});

app.post("/signup",function(req,res){
    const newUser = new User({
        username: req.body.username
    });
    User.register(newUser,req.body.password,function(err,user){
        if(err){
            console.log("err")
            res.render('signup')
        }else{
            //ON LE CREE UNE SESSION GRACE A PASSPORT
            passport.authenticate("local")(req,res,function(){
                res.redirect("signup");
            });
        }
    })
});

app.get("/login",function(req,res){
   res.render("login"); 
});

app.post("/login",function(req, res){
    const user = new User({
        username: req.body.username,
        paswword: req.body.password
    });
    //créer une session
    req.login(user,function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req,res,function(){
                req.flash('success','Congratulations, you are logged in ! ');
                res.redirect("/dashboard");
            })
        }
    }) 
});

//Cannot POST /login --- un manque une rouge get

//app.get('/dashboard',function(req,res){
app.get('/dashboard',isLoggedIn,function(req,res){
    console.log(req.user)
    res.render('dashboard')
});

app.listen(3000,function(req,res){
   console.log("app listening at http://localhost:3000"); 
});

app.get('/logout', function(req, res){
    req.logout();
    req.flash('success','Thank you, you are now logged out ! ');
    res.redirect('/login');
});


//Mot de passe oublié
app.get('/forgot',function(req, res){
    res.render('forgot');
});

app.post('/forgot',function(req, res){
    User.findOne({username: req.body.username},function(err,userfound){
        if(err){
            console.log(err);
            res.redirect('/login');
        }else{
            //creation du token
            const token = randToken.generate(16);
            Reset.create({
                username: userfound.username,
                resetPasswordToken: token,
                resetPasswordExpires: Date.now() + 3600000 // 1h en milliseconde
            });
            
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'kouens2010@gmail.com',
                    pass: process.env.PWD
                }
            });
            const mailOptions = {
                from: 'kouens2010@gmail.com',
                to:req.body.username,
                subject: 'link to reset your password',
                text: 'click on this link to reset your password: http://localhost:3000/reset/'+token
            }
            console.log('le mail est pret a etre envoye');
            console.log('http://localhost:3000/reset/'+token);
            
            transporter.sendMail(mailOptions,function(err,response){
                if(err){
                    console.log(err);
                }else{
                    res.redirect('/login');
                }
            });
        }
    });
});

app.get('/reset/:token',function(req, res){
    Reset.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {$gt: Date.now()}
    },function(err,obj){
        if(err){
            console.log("token expired");
            res.redirect('/login')
        }else{
            res.render('/reset', {token: req.params.token});
        }
    });
});

//RESET TOKEN
app.post('/reset/:token',function(req, res){
    Reset.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {$gt: Date.now()}
    },function(err,obj){
        if(err){
            //console.log("token expired");
            req.flash('error','token expired. ');
            res.redirect('/login')
        }else{
            if(req.body.password == req.body.password2){
                User.findOne({username: obj.username }, function(err,user){
                    if(err){
                        console.log(err);
                    }else{ //setPassword c'est une methode de passport
                        user.setPassword(req.body.password,function(err){
                            if(err){

                            }else{
                                user.save();
                                const updateReset = {
                                    resetPasswordToken: null,
                                    resetPasswordExpires: null
                                }
                                Reset.findOneAndUpdate({resetPasswordToken: req.params.token},updateReset,function(err,obji){
                                    if(err){
                                        console.log(err);
                                    }else{
                                        req.flash('success','Successfully updated your password ');
                                        res.redirect("/login");
                                    }
                                });
                            }
                        });
                    }
                });   
            }
        }
    });
});

//RECEIPT ROUTE
app.get('/dashboard/myreceipes',isLoggedIn, function(req, res){
    //recuperer les recette
    Receipe.find({
        user: req.user.id
    },function(err,receipe){
        if(err){
            console.log(err);
        }else{
            res.render('receipe',{ receipe: receipe });
        }
    });
});

app.get('/dashboard/newreceipe',isLoggedIn, function(req, res){
    res.render('newreceipe');
});


app.post('/dashboard/newreceipe',isLoggedIn, function(req, res){
    const newReceipe = {
        name: req.body.receipe,
        image: req.body.logo,
        user: req.user.id
    }
    Receipe.create(newReceipe,function(err, newReceipe){
        if(err){
            console.log(err)
        }else{
            req.flash('success','new receipe added ! ');
            res.redirect('/dashboard/myreceipes');
        }
  })
});

app.get('/dashboard/myreceipes/:id',function(req, res){
    //on filtre par rapport l'user connecté
    Receipe.findOne({ user: req.user.id, _id: req.params.id }, function(err,receipeFound){
        if(err){
            console.log(err)
        }else{
            //console.log(receipeFound)
            //recuperer les ingrediant qui correspond à la recette
            Ingredient.find({
                user: req.user.id,
                receipe: req.params.id      //cle étrangère
            },function(err,ingredientFound){
                if(err){
                    console.log(err)
                }else{
                    res.render('ingredients',{
                        ingredient: ingredientFound,
                        receipe: receipeFound
                    })
                }
            })

        }
    })
});


app.get('/dashboard/myreceipes/:id/newingredient',function(req, res){
    Receipe.findById({_id:req.params.id},function(err,found){
        if(err){
            console.log(err);
        }else{
            res.render('newingredient',{receipe: found});
        }
    })
});

//ADD INGREDIENT
app.post('/dashboard/myreceipes/:id',function(req, res){
    //recup ingredient
    const newIngredient = {
        name: req.body.name, //value entries user
        bestDish: req.body.dish,
        user: req.user.id,
        quantity: req.body.quantity,
        receipe: req.params.id //recup id lien GET
    }
    Ingredient.create(newIngredient,function(err,newIngredient){
        if(err){
            console.log(err)
        }else{
            req.flash('success','your ingredient has been added!');
            res.redirect('/dashboard/myreceipes/'+req.params.id);
        }
    })
});


//DELETE INGRDIANT
app.delete('/dashboard/myreceipes/:id/:ingredientid',isLoggedIn,function(req,res){
    Ingredient.deleteOne({_id:req.params.ingredientid},function(err){
        if(err){
            console.log(err);
        }else{
            req.flash('success','your ingredient has been deleted!');
            res.redirect("/dashboard/myreceipes/"+req.params.id);
        }
    });
});

//UPDATE INGREDIENT
app.post('/dashboard/myreceipes/:id/:ingredientid/edit',isLoggedIn,function(req,res){
    Receipe.findOne({user:req.user.id,_id:req.params.id},function(err){
        if(err){
            console.log(err);
        }else{
            Ingredient.findOne({
                _id:req.params.ingredientid,
                receipe: req.params.id
            },function(err,ingredientFound){
                if(err){
                    console.log(err)
                }else{
                    res.render("edit",{
                        ingredient: ingredientFound,
                        receipe: receipeFound
                    });
                }
            });
        }
    });
});

app.put('/dashboard/myreceipes/:id/:ingredientid',isLoggedIn, function(req, res){
    const ingredient_upadated =  {
        name: req.body.name,
        bestDish: req.body.dish,
        user: req.body.id,
        quantity: req.body.quantity,
        receipe: req.params.id,
    }
    Ingredient.findByIdAndUpdate({_id: 
        req.params.ingredientid},ingredient_upadated,function(err,updatedIngredient){
            if(err){
                console.log(err);
            }else{
                req.flash('success','Successfully updated your ingredient !');
                res.redirect('/dashboard/myreceipes/'+req.params.id);
            }
        });
});

//DELETE RECETTE
app.get('/dashboard/myreceipes/:id/',isLoggedIn,function(req, res){
   Receipe.deleteOne({_id: req.params.id},function(err){
        if(err){
            console.log(err);
        }else{
            req.flash('success','The receipe has benn deleted!');
            res.redirect('/dashboard/myreceipes');
        }
   });
}); 

//------- DEBUT FAVORIS ---------------------
app.get('/dashboard/favourites',isLoggedIn,function(req, res){
    Favourite.find({user: req.user.id},function(err,favouriteFound){
        if(err){
            console.log(err);
        }else{
            res.render('favourites',{favourite: favouriteFound}); //ici on passe le resultat trouvé dans un objet js qu'on va parcourir dans la vue
        }
    })
});

app.get('/dashboard/favourites/newfavourite',isLoggedIn,function(req,res){
    res.render('newfavourite');
});

app.post('/dashboard/favourites',isLoggedIn,function(req,res){
    //recuperation des informations formulaire
    const newFavourite = {
        image: req.body.image,
        title: req.body.title,
        description: req.body.description,
        user: req.user.id
    }
    Favourite.create(newFavourite,function(err,newFavourite){
        if(err){
            console.log(err);
        }else{
            req.flash('success','you just added a new fav!');
            res.redirect('/dashboard/favourites')
        }
    });
});

//DELETE Favourite
app.delete('/dashboard/favourites/:id/',isLoggedIn,function(req, res){
    Favourite.deleteOne({_id: req.params.id},function(err){
         if(err){
             console.log(err);
         }else{
             req.flash('success','The fav has benn deleted!');
             res.redirect('/dashboard/favourites');
         }
    });
 }); 
 
//------------------------ Debut schedules FAVORIS --------------------------------
app.get('/dashboard/schedule',isLoggedIn,function(req, res){
    Schedule.find({_id:req.user.id},function(err,scheduleFound){
        if (err) {
            console.log(err)
        }else{
            res.render('schedule',{schedule: scheduleFound});
        }
    })
    
});

app.get('/dashboard/schedule/newschedule',isLoggedIn,function(req,res){
    res.render('newSchedule');
})

app.post('/dashboard/schedule',isLoggedIn,function(req,res){
    //recup data form
    const newSchedule = {
        Receiptename: req.body.receipename,
        scheduleDate: req.body.scheduleDate, 
        user: req.body.id,
        time: req.body.time,
    }
    Schedule.create(newSchedule,function(err,newSchedule){
        if(err){
            console.log(err);
        }else{
            req.flash('success','you just added a new schedule');
            res.redirect('/dashboard/schedule');
        }
    });
});

//DELETE SCHEDULE
app.delete('/dashboard/schedule/:id',isLoggedIn,function(req,res){
    Schedule.deleteOne({_id: req.params.id},function(err){
        if(err){
            console.log(err);
        }else{
            req.flash('success','you are successfully deleted the schedule !');
            res.redirect('/dashboard/schedule');
        }
});

//FONCTION DE CONNEXION
function isLoggedIn(req,res,next){
    if(req.isAuthenticated()){
        return next()
    }else{
        req.flash('error','Please login first!')
        res.redirect('/login')
    }
}
