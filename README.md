
# AI Preference NFT: Your Personal AI Customization Companion 🚀

The **AI Preference NFT** uniquely represents FHE-encrypted personal preferences for AI customization, empowering users to dictate how they interact with AI applications. By harnessing **Zama's Fully Homomorphic Encryption technology**, this project guarantees that your preferences remain private and secure while enabling a seamless AI experience across platforms.

## Identifying the Problem 🛑

In an age where AI has infiltrated numerous aspects of our lives, users often face a lack of control over how these systems understand and respond to them. Personal preferences, including tone and knowledge range, are frequently stored without adequate privacy measures, leading to potential misuse of sensitive personal data. Furthermore, many users find it challenging to maintain consistent AI interactions across multiple applications due to the fragmented nature of AI systems.

## FHE: The Key to Privacy 🔒

Our solution leverages **Fully Homomorphic Encryption (FHE)** to address these pain points head-on. By using **Zama's open-source libraries**, such as **Concrete**, **TFHE-rs**, and the **zama-fhe SDK**, we can securely encrypt personal preferences, ensuring that users’ choices are not only private but also portable. This makes it possible for users to embed their preferences into any compatible AI application without the risk of exposing sensitive information.

## Key Features 🌟

- **User AI Preferences Encrypted and NFT-ified**: Store personalized AI interaction preferences securely and uniquely as an NFT.
- **Portable and Tradable Assets**: Convert AI customization configurations into assets that can be easily transferred or traded.
- **Cross-Platform, Privacy-Conscious Consistency**: Achieve uniformity in AI experiences across various platforms, all while protecting your private information.
- **Foundation for Personal AI Era**: Establish essential infrastructure for the future of personalized AI interactions.

## Technology Stack 🛠️

The project employs a robust technology stack, including:

- **Smart Contract Language**: Solidity
- **Blockchain Platform**: Ethereum
- **Zama SDK**: **zama-fhe SDK** for confidential computation
- **Development Tools**: Node.js, Hardhat

## Directory Structure 📂

Here’s an overview of the project's directory structure:

```
aiPreferenceNFT_FHE/
├── contracts/
│   └── aiPreferenceNFT.sol
├── scripts/
│   └── deploy.js
├── test/
│   └── aiPreferenceNFT.test.js
├── package.json
└── README.md
```

## Installation Guide ⚙️

To get started with the AI Preference NFT project, follow these steps:

1. Ensure you have **Node.js** and either **Hardhat** or **Foundry** installed on your machine.
2. Navigate to the project directory.
3. Run the following command to install the required dependencies, including Zama's FHE libraries:

```bash
npm install
```

> **Important:** Do not use `git clone` or any URLs to download the project. Ensure you have the correct version of all dependencies to avoid compatibility issues.

## Build & Run Guide 🚀

After you have installed the project dependencies, you can compile, test, and run the project using the following commands:

1. **Compile the smart contracts**:

```bash
npx hardhat compile
```

2. **Run the tests**:

```bash
npx hardhat test
```

3. **Deploy the smart contract**:

```bash
npx hardhat run scripts/deploy.js
```

## Example Usage ✨

Here's a quick code snippet that demonstrates how to deploy your **AI Preference NFT** smart contract and set user preferences:

```javascript
const hre = require("hardhat");

async function main() {
    const AIPreferenceNFT = await hre.ethers.getContractFactory("aiPreferenceNFT");
    const aiPreferenceNFT = await AIPreferenceNFT.deploy();
    await aiPreferenceNFT.deployed();

    console.log("AI Preference NFT deployed to:", aiPreferenceNFT.address);

    // Setting user preferences
    const userPreferences = {
        tone: "friendly",
        knowledgeScope: "technology",
    };
    
    await aiPreferenceNFT.setUserPreferences(userPreferences);
    console.log("User preferences have been set!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

## Acknowledgements 🙏

This project is **powered by Zama**, whose pioneering work in Fully Homomorphic Encryption and open-source tools has made confidential blockchain applications like the AI Preference NFT possible. We express our gratitude to the Zama team for their innovation and dedication to enhancing privacy in the digital world.

---

By creating an NFT that holds your personalized AI interaction preferences in a secure and portable format, the AI Preference NFT empowers individuals to take control of their AI experiences like never before. Get involved and experience the future of personalized AI!
```
