const mongoose = require("mongoose");
const passportLocalStrategy = require("passport-local-mongoose");

const userSchema  = new mongoose.Schema({
    username: String,
    password: String
});

userSchema.plugin(passportLocalStrategy);

module.exports = mongoose.model("User",userSchema);