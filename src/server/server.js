"use strict";

import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import fs from 'fs';

/********************************************************************************************/
/*                               SMART CONTRACT INTERACTIONS                                */
/********************************************************************************************/

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

const ORACLE_REGISTRATION_FEE = web3.utils.toWei('1');
const STATUS_CODES = [0, 10, 20, 30, 40, 50]; // See flightsurety.js for code names
const FLIGHT_CODES = ['AA_001', 'AC_014','CO_005', 'DL_006']; // See flightsurety.js for code names
const NUMBER_OF_ORACLES = 2;
let oracles = [];
let accounts = [];

// Req 4.1 (Oracles): Oracles are implemented as a server app
// Req 4.2 (Oracles):	Upon startup, 20+ oracles are registered, and their assigned indexes are persisted in memory

// Need to spin up oracles, register them, persist their state in memory,
// or if you choose to write it to a file you don't have to re-register them every time
(async () => {
  accounts = await web3.eth.getAccounts();
  console.log(accounts[11])

  if (oracles.length == 0) {
    for (let i = 0; i < NUMBER_OF_ORACLES; i++) {
      console.log('Register oracle ', i)
      // account 0 = owner, 1-5 = airlines, 6-10 = passengers, 11-30 = oracles
      try {
        await flightSuretyApp.methods.registerOracle()
        .send({from: accounts[i + 11], value: ORACLE_REGISTRATION_FEE, gas: 6700000});
      }
      catch (e) {
        console.log(e);
      }
      let indexes = await flightSuretyApp.methods.getMyIndexes().call({from: accounts[i + 11], gas: 6700000});
      console.log(indexes);
      
    }
  }
})();

flightSuretyApp.events.OracleRegistered({
  fromBlock: 0
}, function (err, event) {
  console.log('Oracle registered event fired!')
  console.log(event.returnValues)
  if (err) {
    console.log(err)
    // throw new Error(err.message);
  }
  let {oracle, indexes} = event.returnValues;
  oracles.push({
    address: oracle,
    indices: indexes
  });
});

// Listening for a request - does nothing with regards to handling the request
flightSuretyApp.events.OracleRequest({
  fromBlock: 0
}, function (err, event) {
  console.log('Oracle request event fired!')
  console.log(event.returnValues)
  if (err) {
    console.log(err)
    // throw new Error(err.message);
  }
  let {index, airline, flight, timestamp} = event.returnValues;
  // for (let i = 0; i < NUMBER_OF_ORACLES; i++) {
  //   if (oracles[i].indexes.includes(index)) {
  //     // Come up with the answer as to whether the flight is late or not,
  //     // respond back by pushing a transaction to the smart contract
  //     let statusCode = STATUS_CODES[getRandomInt(6)];
  //     flightSuretyApp.methods.submitOracleResponse
  //       .send(index, airline, flight, timestamp, statusCode, {from: oracles[i].address});
  //   }
  // }
});


/********************************************************************************************/
/*                                       FE INTERACTIONS                                    */
/********************************************************************************************/

const app = express();

app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
})

// Have an endpoint that returns hardcoded flights and timestamps and hydrates a dropdown in the UI
app.get('/api/flights', (req, res) => {
  const currentTimestamp = Math.floor(Date.now() / 1000); 
  res.send([{
      flight: FLIGHT_CODES[0],
      times: [currentTimestamp + 60,  currentTimestamp + 3600, currentTimestamp + 86000]
    }, {
      flight: FLIGHT_CODES[1],
      times: [currentTimestamp + 120,  currentTimestamp + 7200, currentTimestamp + 172000]
    }, {
      flight: FLIGHT_CODES[2],
      times: [currentTimestamp + 180,  currentTimestamp + 10800, currentTimestamp + 258000]
    }, {
      flight: FLIGHT_CODES[3],
      times: [currentTimestamp + 360,  currentTimestamp + 14400, currentTimestamp + 344000]
    }
  ]);
})

// app.get('/api/test', async (req, res) => {
//   console.log('calling get indexes:')
//   const indexes = await flightSuretyApp.methods.getOracle(accounts[7]).call({from: accounts[0]})
//   console.log(indexes)
// })

export default app;





  // fs.readFile('./src/server/oracles.json', (err, data) => {
  //   if (err) console.log(err);
  //   if (data) {
  //     console.log("Oracles fetched from memory: ")
  //     oracles = JSON.parse(data);
  //     console.log(oracles);
  //   }
  // });

  // console.log('Writing oracle to memory...')
  // fs.writeFile('./src/server/oracles.json', JSON.stringify(oracle), (err, data) => {
  //   if(err) console.log(err);
  // });