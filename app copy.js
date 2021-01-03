const express = require('express');
const app = express(); //instancier express

const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');

//Cryptage de mot de passe et securité
const bcrypt = require('bcrypt');
//const myPlaintextPassword = 's0/\/\P4$$w0rD';
//const someOtherPlaintextPassword = 'not_bacon';


//connexion depuis le cloud
mongoose.connect("mongodb+srv://userOpendev:19858519PaT@cluster0.xxexf.mongodb.net/cooking?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const methodOverride = require('method-override');
const flash = require('connect-flash');

//EJS
app.set("view engine","ejs");

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

//rendre le contenu public en statique
app.use(express.static("public"));

//Models
const User = require("./models/user");

//page acceuil
app.get('/',function(req,res){
    res.render("index");
});

app.get("/signup",function(req,res){
    res.render("signup");
});

app.post("/signup",function(req,res){
    //crypter le mot de passe
    const saltRounds = 10;
     bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
         //recuperation des valeurs entrées
        const user = {
            username: req.body.username,
            password: hash
        }
        //appel du model
        User.create(user,function(r){
            if(r){
                console.log(r);
            }else{
                res.render("index");
            }
        });

    });  
});

app.get("/login",function(req,res){
   res.render("login"); 
});

app.post("login",function(req,res){
    //Verifier si l'user existe dans la base de données
    User.findOne({username: req.body.username},function(err,foundUser){
        if(err){
            console.log(err);
        }else{
            //on test si l'user existe et que son mot de passe est identique
            if(foundUser){
/*                 if(foundUser.password === req.body.password){
                    res.render("index");
                } */
                bcrypt.compare(req.body.password,foundUser.password,function(err,resultat){
                    if(result==true){
                        console.log("tu es connecté");
                        res.render("index");
                    }else{
                        console.log("tu n'est pas connecté");
                        res.render("index");
                    }
                })
            }else{
                //console.log("User n'existe pas");
                res.send("User n'existe pas");
            }
        }
    }); 
});

app.listen(3000,function(req,res){
   console.log("app listening at http://localhost:3000"); 
});