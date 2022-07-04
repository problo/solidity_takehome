import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { MockProvider } from "ethereum-waffle";
import { isCallTrace } from "hardhat/internal/hardhat-network/stack-traces/message-trace";
import { ERC20 } from "../typechain/ERC20";
import { Vault } from "../typechain/Vault";
import { ERC20__factory } from "../typechain/factories/ERC20__factory";
import { Vault__factory } from "../typechain/factories/Vault__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { sign } from "crypto";
import { timeEnd } from "console";

const { provider } = waffle;

async function increaseBlockTimestamp(provider: MockProvider, time: number) {
  await provider.send("evm_increaseTime", [time]);
  await provider.send("evm_mine", []);
};

async function getCurrentBlockTimestamp(_provider: MockProvider) {
  const blockNumber = await _provider.getBlockNumber();
  return (await _provider.getBlock(blockNumber)).timestamp;
};

describe("Vault", function () {
  let token: ERC20;
  let vault: Vault;
  let signers: SignerWithAddress[];

  const name = 'token';
  const symbol = 'TKN';

  const initial_mint = 100;
  const grant_amount = 30;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    const deployer_vault = new Vault__factory(signers[0]);
    const deployer_token = new ERC20__factory(signers[1]);
    token = await deployer_token.deploy(name, symbol);
    vault = await deployer_vault.deploy(token.address);
    await token.mint(signers[1].address, initial_mint);
  });

  describe("Create Grant", async () => {
    it("Should fail when not called by the owner", async () => {
      let unlockTime = await getCurrentBlockTimestamp(provider) + 60;
      await expect(vault.connect(signers[2]).createGrant(signers[1].address, signers[2].address, grant_amount, unlockTime)).to.revertedWith("Ownable: caller is not the owner");
    });

    describe("Successful case", async () => {
      let unlockTime = 0;
      beforeEach(async () => {
        await token.approve(vault.address, grant_amount);
        unlockTime = await getCurrentBlockTimestamp(provider) + 60;
        await vault.createGrant(signers[1].address, signers[2].address, grant_amount, unlockTime);
      });
  
      it("Transfer tokens", async () => {
        expect(await token.balanceOf(vault.address)).to.equal(grant_amount);
        expect(await token.balanceOf(signers[1].address)).to.equal(initial_mint - grant_amount);
      });
  
      it("Store the grant info", async () => {
        const [funder, recipient, amount, unlockTimestamp] = await vault.grants(0);
        expect(funder).to.equal(signers[1].address);
        expect(recipient).to.equal(signers[2].address);
        expect(amount).to.equal(grant_amount);
        expect(unlockTimestamp).to.equal(unlockTime);
      });
    });
  });

  describe("Remove Grant", async () => {
    beforeEach(async () => {
      await token.approve(vault.address, grant_amount);
      let unlockTime = await getCurrentBlockTimestamp(provider) + 60;
      await vault.createGrant(signers[1].address, signers[2].address, grant_amount, unlockTime);
    });

    it("Should fail when trying to remove a non-existing grant", async () => {
      await expect(vault.connect(signers[1]).removeGrant(1)).to.revertedWith("The grant does not exist!");
    });

    it("Should fail when not called by the funder", async () => {
      await expect(vault.connect(signers[2]).removeGrant(0)).to.revertedWith("Only the funder can remove a grant!");
    });

    it("Should fail when called after the grant is unlocked", async () => {
      increaseBlockTimestamp(provider, 200);
      await expect(vault.connect(signers[1]).removeGrant(0)).to.revertedWith("The grant has already been unlocked!");
    });

    describe("Successful case", async () => {
      beforeEach(async () => {
        await vault.connect(signers[1]).removeGrant(0);
      });
  
      it("Grant info deleted", async () => {
        let [funder, recipient, amount, unlockTimestamp] = await vault.grants(0);
        expect(funder).to.equal('0x0000000000000000000000000000000000000000');
        expect(recipient).to.equal('0x0000000000000000000000000000000000000000');
        expect(amount).to.equal(0);
        expect(unlockTimestamp).to.equal(0);
      });
  
      it("Tokens returned to the funder", async () => {
        expect(await token.balanceOf(vault.address)).to.equal(0);
        expect(await token.balanceOf(signers[1].address)).to.equal(initial_mint);
      });
    });
  });

  describe("Claim Grant", async () => {
    beforeEach(async () => {
      await token.approve(vault.address, grant_amount);
      const blockNumber = await ethers.provider.getBlockNumber();
      let unlockTime = await getCurrentBlockTimestamp(provider) + 60;
      await vault.createGrant(signers[1].address, signers[2].address, grant_amount, unlockTime);
    });

    it("Should fail when trying to claim a non-existing grant", async () => {
      await expect(vault.connect(signers[2]).claimGrant(1)).to.revertedWith("The grant does not exist!");
    });

    it("Should fail when not called by the recipient", async () => {
      await expect(vault.connect(signers[3]).claimGrant(0)).to.revertedWith("Only the recipient can claim a grant!");
    });

    it("Should fail when called before the grant is unlocked", async () => {
      await expect(vault.connect(signers[2]).claimGrant(0)).to.revertedWith("The grant has not been unlocked yet!");
    });

    describe("Successful case", async () => {
      beforeEach(async () => {
        increaseBlockTimestamp(provider, 200);
        await vault.connect(signers[2]).claimGrant(0);
      });

      it("Tokens transferred to the recipient", async () => {
        expect(await token.balanceOf(vault.address)).to.equal(0);
        expect(await token.balanceOf(signers[2].address)).to.equal(grant_amount);
      });

      it("Grant info deleted", async () => {
        let [funder, recipient, amount, unlockTimestamp] = await vault.grants(0);
        expect(funder).to.equal('0x0000000000000000000000000000000000000000');
        expect(recipient).to.equal('0x0000000000000000000000000000000000000000');
        expect(amount).to.equal(0);
        expect(unlockTimestamp).to.equal(0);
      });
    });
  });
});