import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { ERC20 } from "../typechain/ERC20";
import { ERC20__factory } from "../typechain/factories/ERC20__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, ContractTransaction } from "ethers";
import { isCallTrace } from "hardhat/internal/hardhat-network/stack-traces/message-trace";

const { provider } = waffle;

describe("erc20", function () {
  let deployer: ERC20__factory;
  let token: ERC20;
  let signers: SignerWithAddress[];

  const name = 'token';
  const symbol = 'TKN';

  before(async () => {
    signers = await ethers.getSigners();
    deployer = new ERC20__factory(signers[0]);
  });

  beforeEach(async () => {
    token = await deployer.deploy(name, symbol);
    await token.mint(signers[0].address, ethers.utils.parseEther("100"));
  });

  describe("attributes", async () => {
    it('check name', async () => {
      expect(await token.name()).to.equal(name);
    });
  
    it('check symbol', async () => {
      expect(await token.symbol()).to.equal(symbol);
    });
  
    it('has 18 decimals', async () => {
      expect(await token.decimals()).to.equal(18);
    });
  });
  
  describe("mint", async () => {
    it("increments total supply", async () => {
      expect(await token.totalSupply()).to.be.eq(ethers.utils.parseEther("100"));
    });

    it("increments recipient balance", async () => {
      expect(await token.balanceOf(signers[0].address)).to.be.eq(ethers.utils.parseEther("100"));
    });
  });

  describe("transfer functionality", async () => {
    it("transfers successfully", async () => {
      await token.transfer(signers[1].address, ethers.utils.parseEther("5"));
      expect(await token.balanceOf(signers[0].address)).to.be.eq(
        ethers.utils.parseEther("95")
      );
      expect(await token.balanceOf(signers[1].address)).to.be.eq(
        ethers.utils.parseEther("5")
      );
    });

    it("does not transfer more than balance", async () => {
      const tx = token.transfer(
        signers[1].address,
        ethers.utils.parseEther("500")
      );
      await expect(tx).to.be.revertedWith("ERC20: insufficient-balance");
    });
    
  });

  describe("approve", async () => { 90
    let tx1 : ContractTransaction;
    let tx2 : ContractTransaction;

    beforeEach(async () => {
      tx1 = await token.approve(signers[1].address, ethers.utils.parseEther("50"));
      tx2 = await token.approve(signers[2].address, ethers.constants.MaxUint256);
    });

    it("emits events", async () => {
      expect(tx1).to.emit(token, 'Approval').withArgs(signers[0].address, signers[1].address, ethers.utils.parseEther("50"));
      expect(tx2).to.emit(token, 'Approval').withArgs(signers[0].address, signers[2].address, ethers.constants.MaxUint256);
    });

    it("allowance changes", async () => {
      expect(await token.allowance(signers[0].address, signers[1].address)).to.equal(ethers.utils.parseEther("50"));
      expect(await token.allowance(signers[0].address, signers[2].address)).to.equal(ethers.constants.MaxUint256);
    });
  });

  describe("transferFrom", async () => {
    beforeEach(async () => {
      await token.approve(signers[1].address, ethers.utils.parseEther("50"));
      await token.approve(signers[2].address, ethers.constants.MaxUint256);
    });

    it("should fail when trying to transfer more than balance", async () => {
      await expect(token.connect(signers[1]).transferFrom(signers[0].address, signers[2].address, ethers.utils.parseEther("500"))).to.be.revertedWith("ERC20: insufficient-balance");
    });

    it("should fail when trying to transfer more than allowance", async () => {
      const tx = token.connect(signers[1]).transferFrom(signers[0].address, signers[2].address, ethers.utils.parseEther("80"));
      await expect(tx).to.be.revertedWith("ERC20: insufficient-allowance");
    });

    describe("successful transfer", async () => {
      beforeEach(async () => {
        await token.connect(signers[1]).transferFrom(signers[0].address, signers[2].address, ethers.utils.parseEther("30"));
        await token.connect(signers[2]).transferFrom(signers[0].address, signers[1].address, ethers.utils.parseEther("50"));
      });

      it("allowance decreases if it was not UINT.max", async () => {
        expect(await token.allowance(signers[0].address, signers[1].address)).to.equal(ethers.utils.parseEther("20"));
      });

      it("allowance does not change if it was UINT.max", async () => {
        expect(await token.allowance(signers[0].address, signers[2].address)).to.equal(ethers.constants.MaxUint256);
      });

      it("balance changes", async () => {
        expect(await token.balanceOf(signers[0].address)).to.equal(ethers.utils.parseEther("20"));
        expect(await token.balanceOf(signers[1].address)).to.equal(ethers.utils.parseEther("50"));
        expect(await token.balanceOf(signers[2].address)).to.equal(ethers.utils.parseEther("30"));
      });
    });
  });
});
