
var Test = require('../config/testConfig.js');
//var BigNumber = require('bignumber.js');

contract('Oracles', async (accounts) => {
  
  var config;
  const TEST_ORACLES_COUNT = 5;
  const STATUS_CODES = {
    STATUS_CODE_UNKNOWN: 0,
    STATUS_CODE_ON_TIME: 10,
    STATUS_CODE_LATE_AIRLINE: 20,
    STATUS_CODE_LATE_WEATHER: 30,
    STATUS_CODE_LATE_TECHNICAL: 40,
    STATUS_CODE_LATE_OTHER: 50
  };
  
  before('setup contract', async () => {
    config = await Test.Config(accounts);
  });


  it('can register oracles', async () => {
    // ARRANGE
    let fee = await config.flightSuretyApp.ORACLE_REGISTRATION_FEE.call();
    
    // ACT
    for(let a = 0; a < TEST_ORACLES_COUNT; a++) {      
      await config.flightSuretyApp.registerOracle({ from: accounts[a + 11], value: fee });
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a + 11]});
      console.log(`          Oracle Registered: ${oracleIndexes[0]}, ${oracleIndexes[1]}, ${oracleIndexes[2]}`);
    }
  });

  it('can request flight status', async () => {
    // ARRANGE
    const airline = config.owner;
    const flight = 'ND1309';
    const timestamp = Math.floor(Date.now() / 1000) + 500;
    // Submit a request for oracles to get status information for a flight
    console.log('          Fetch flight status for:', airline, flight, timestamp, '\n');
    await config.flightSuretyApp.fetchFlightStatus(airline, flight, timestamp);

    // ACT
    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for(let a = 0; a < TEST_ORACLES_COUNT; a++) {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a + 11]});
      for(let idx = 0; idx < 3; idx++) {
        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], airline, flight, timestamp, STATUS_CODES.STATUS_CODE_ON_TIME,
            { from: accounts[a + 11] });
          console.log('          Success! Oracle', a, 'index', idx, '=', oracleIndexes[idx].toNumber(),
            'matched the request index for:', airline, flight, timestamp);
        }
        catch(e) {
          // Enable this when debugging
          console.log('          Failure! Oracle', a, 'index', idx, '=', oracleIndexes[idx].toNumber(),
            'did not match the request index for:', airline, flight, timestamp);
        }
      }
      console.log('');
    }
  });
});
