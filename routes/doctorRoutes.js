import express from "express";
import {EditToken} from "../controllers/doctor/EditToken.js";
import { UpdateBasicDetails, UpdateSettings } from "../controllers/doctor/UpdateDetails.js";
import { authorizeDoctor } from "../middlewares/authorize.js";
import con from "../models/db.js";
import { getCurrentDate } from "../utils/calendar.js";
const doctorRouter =  express.Router();


doctorRouter.post("/getDoctorDetails", authorizeDoctor, async(req, res) => {
    const doctorID = req.doctorID;

    if(doctorID){
        try {
            const sql = "select d.did, d.name, d.location, d.speciality, d.timings, d.slots, d.myLocations, u.phone, u.email from doctors as d inner join users as u where d.did=? and u.uid=?";

            con.query(sql,[[doctorID], [doctorID]], function(err, result){
                if(err){
                    return res.json({success:false, msg:"Internal Server Error Occurred"})
                }
                else if(result.length>0){
                    return res.json({success:true, data:result})
                }
                else{
                    return res.json({success:false, msg:"Your details are not available"})
                }
            })
        }
        catch (error) {
            return res.json({success:false, msg:"Internal Server Error Occurred"})
        }
    }
    else{
        return res.json({success:false, msg:"No details found. Please try again after some time"})
    }
})



doctorRouter.post("/getTodayAppointments", authorizeDoctor, async(req, res)=>{
//    const {slot} = req.body; 
   const date = await getCurrentDate();
   const sql = `select a.*, d.timings from appointments a left join doctors d on a.doctorID=d.did where a.appointmentDate = ? && a.doctorID = ?`;

    // if(!slot) return res.json({ success: false, msg: "Invalid Slot", err })

    try {
        con.query(sql, [[date], [req?.doctorID]], (err, result) => {
            if (err) return res.json({ success: false, msg: "Unexpected error occurred", err })
            else if (result.length > 0) {
                return res.status(200).json({ success: true, data: result })
            }
            else return res.json({ success: false, msg: "No Appointments Found Today" });
        })
    }
    catch (error) {
        return res.json({ success: false, msg: "Internal error occurred" })
    }
})



doctorRouter.get("/getAppointments", authorizeDoctor ,(req,res)=>{
    const sql = "select * from appointments where doctorID = ?";

    con.query(sql, [[req.doctorID]], function (err, result) {
        if (err) return res.json({ success: false, msg: "Unexpected problem occurred while getting appointments" });

        else if (result.length > 0) return res.json({ success: true, data: result })

        else return res.json({ success: false, msg: "No Appointments Found" });
    })
})



doctorRouter.post("/operation", authorizeDoctor , (req,res)=>{
   const {ids, emails,  op} = req.body;

   let status = op === "approve" ? 1 : -1;
   let sql = `update appointments set status = ${status} where id = `;

   // query to update multiple ids at same time with help of appending the string with OR in sql
   ids.map((id, index)=>{
       if(index==0)
           sql += `${id}`

       else
           sql += ` or id=${id}`
   })

   con.query(sql, function(err, result){
       if(err)
           return res.json({success:false, msg:"Internal Server Error Occurred"});

       else if(result.affectedRows>0)
       {
           let msg;
           if(result.affectedRows==1 && status==-1)
               msg=`1 Appointment Rejected`
           else if(result.affectedRows>1 && status==-1)
               msg=`${result.affectedRows} Appointments Rejected`
           else if(result.affectedRows==1 && status==1)
               msg=`1 Appointment Approved`
           else if(result.affectedRows>1 && status==1)
               msg=`${result.affectedRows} Appointments Approved`
           
           // sending mails to users
           let appointmentStatus = status==1 ? "Approved": "Rejected";
           // emails.forEach(email => {
           //     if(email && email!==null && email!=="")
           //     {
           //         Mail(email, appointmentStatus);
           //     }
           // });
           return res.json({success:true, msg})
       }
       else
           return res.json({success:false, msg:"Internal Server Error Occurred"});
   })
})



doctorRouter.patch("/editToken", authorizeDoctor , async(req, res)=>{
   EditToken(req, res, con);
})



doctorRouter.patch("/updateDoctorDetails", authorizeDoctor, async(req, res) => {
    const {did} = req.body.data
    switch (req.body.type) {
        case "basic":
            const {name, email, phone, speciality } = req.body.data
            UpdateBasicDetails(did, name, email, phone, speciality, con, res)
            break;

        case "settings":
            const {slots, timings, location} = req.body.data
            UpdateSettings(did, slots, timings, location, con, res)
            break;

        case "privacy":
            const { pass, oldPass } = req.body.data
            UpdatePassword(pass, oldPass, con, res)
            break;

        default:
            break;
    }
})

export default doctorRouter;
