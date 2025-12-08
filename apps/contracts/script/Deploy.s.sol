// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/M2MChat.sol";

contract DeployM2MChat is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        address feeCollector = 0x0a01A6423D6bF683F53BFd8C18bF8375E1aA50BC;
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        M2MChat m2mChat = new M2MChat(feeCollector, deployer);

        console.log("===============================================");
        console.log("M2MChat deployed to:", address(m2mChat));
        console.log("Fee Collector:", feeCollector);
        console.log("Owner (admin):", m2mChat.owner());
        console.log("Relayer:", m2mChat.relayer());
        console.log("===============================================");

        vm.stopBroadcast();
    }
}
