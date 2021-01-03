const mongoose = require("mongoose");

const scheduleSchema  = new mongoose.Schema({
    Receiptename: String,
    scheduleDate: {
        type: Date
    },
    user: String,
    time: String,
    Date: {
        type: Date,
        default: Date.now()
    },
});

module.exports = mongoose.model("Schedule",scheduleSchema);