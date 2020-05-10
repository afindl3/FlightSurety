pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
  using SafeMath for uint256;

  /********************************************************************************************/
  /*                                       DATA VARIABLES                                     */
  /********************************************************************************************/

  address private contractOwner;         // Account used to deploy contract
  bool private operational = true;       // Blocks all state changes throughout the contract if false
  uint256 private numberOfRegisteredAirlines = 0; 
  
  struct Airline {
    bool isRegistered;
    bool isFunded;
    uint256 amountPaid;
  }
  mapping(address => Airline) private airlines;

  struct FlightInsurance {
    address[] insurees;
    mapping(address => uint256) amountPaid;
    mapping(address => uint256) amountCredited;
    bool hasBeenPaidOut;
  }
  mapping(bytes32 => FlightInsurance) private flightInsurees;

  mapping(address => bool) private authorizedContracts;

  /********************************************************************************************/
  /*                                       EVENT DEFINITIONS                                  */
  /********************************************************************************************/

  /**
  * @dev Constructor
  *      The deploying account becomes contractOwner
  */
  constructor() public {
    contractOwner = msg.sender;
    // Req 2.1 (Airlines): Register first airline when contract is deployed
    registerAirline(msg.sender);
  }

  /********************************************************************************************/
  /*                                       FUNCTION MODIFIERS                                 */
  /********************************************************************************************/

  // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
      // Req 5.1 (General): Contracts must have operational status control
      require(operational, "Contract is currently not operational");
      _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
      require(msg.sender == contractOwner, "Caller is not contract owner");
      _;
    }

    modifier isCallerAuthorized() {
      require(authorizedContracts[msg.sender] == true, "Caller is not authorized");
      _;
    }

  /********************************************************************************************/
  /*                                       UTILITY FUNCTIONS                                  */
  /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    * @return A bool that is the current operating status
    */      
    function isOperational() public view returns(bool) {
      return operational;
    }

    /**
    * @dev Sets contract operations on/off
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus(bool mode) external requireContractOwner {
      operational = mode;
    }

    function authorizeContract(address contractAddress) external requireContractOwner {
      authorizedContracts[contractAddress] = true;
    }
    function deauthorizeContract(address contractAddress) external requireContractOwner {
      delete authorizedContracts[contractAddress];
    }

  /********************************************************************************************/
  /*                                     SMART CONTRACT FUNCTIONS                             */
  /********************************************************************************************/

  /**
  * @dev Add an airline to the registration queue
  *      Can only be called from FlightSuretyApp contract
  */   
  function registerAirline(address airline) requireIsOperational public {
    numberOfRegisteredAirlines.add(1);
    airlines[airline] = Airline({
      isRegistered: true,
      isFunded: false,
      amountPaid: 0
    });
  }
  function isAirlineRegistered(address airline) external view returns(bool) {
    return airlines[airline].isRegistered == true;
  }
  function getNumberOfRegisteredAirlines() external view returns(uint256) {
    return numberOfRegisteredAirlines;
  }

  function payAirlineRegistrationFee(address airline, uint256 amountPaid) requireIsOperational public {
    airlines[airline].isFunded = true;
    airlines[airline].amountPaid = amountPaid;
  }
  function hasAirlinePaidRegistraionFee(address airline) external view returns(bool) {
    return airlines[airline].isFunded == true;
  }
  
  /**
  * @dev Buy insurance for a flight
  */
  function buy(address airline, string flight, uint256 timestamp, address passenger) requireIsOperational external payable {
    bytes32 flightKey = getFlightKey(airline, flight, timestamp);
    flightInsurees[flightKey].insurees.push(passenger);
    flightInsurees[flightKey].amountPaid[passenger] = msg.value;
  }

  /**
  * @dev Credits payouts to insurees
  */
  function creditInsurees(address airline, string flight, uint256 timestamp, uint256[2] liability) requireIsOperational external {
    bytes32 flightKey = getFlightKey(airline, flight, timestamp);
    require(!flightInsurees[flightKey].hasBeenPaidOut,
      "Passengers accounts' have already been credited for this flight delay");

    uint numberOfInsurees = flightInsurees[flightKey].insurees.length;
    for (uint i=0; i<numberOfInsurees; i++) {
      uint256 amountPaid = flightInsurees[flightKey].amountPaid[flightInsurees[flightKey].insurees[i]];
      uint256 amountToCredit = amountPaid.mul(liability[0]).div(liability[1]);
      flightInsurees[flightKey].amountCredited[flightInsurees[flightKey].insurees[i]] = amountToCredit;
    }
  }

  /**
  * @dev Transfers eligible payout funds to insuree
  */
  function pay(address airline, string flight, uint256 timestamp) requireIsOperational external {
    // Checks
    require(msg.sender == tx.origin,
      "Contracts not allowed");
    bytes32 flightKey = getFlightKey(airline, flight, timestamp);
    require(flightInsurees[flightKey].amountCredited[msg.sender] > 0,
      "Passenger is not eligible for a payout for this flight or has already withdrawn their funds");

    // Effects
    uint256 payout = flightInsurees[flightKey].amountCredited[msg.sender];
    flightInsurees[flightKey].amountCredited[msg.sender] = 0;

    // Interation
    // Req 3.4 (Passengers)	Funds are transferred from contract to the passenger wallet only when they initiate a withdrawal
    msg.sender.transfer(payout);
  }

  /**
  * @dev Initial funding for the insurance. Unless there are too many delayed flights
  *      resulting in insurance payouts, the contract should be self-sustaining
  */   
  function fund() public payable {

  }

  function getFlightKey(address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32) {
    return keccak256(abi.encodePacked(airline, flight, timestamp));
  }

  /**
  * @dev Fallback function for funding smart contract.
  */
  function() external payable {
    fund();
  }

}

