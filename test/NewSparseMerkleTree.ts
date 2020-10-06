import * as crypto from 'crypto'
import chai from "chai"
import Keyv from "keyv"
import { ethers } from "@nomiclabs/buidler"
import { BigNumber, ContractFactory, Signer, Wallet } from "ethers"
import { deployContract, solidity } from "ethereum-waffle"

import {
    hashLeftRight,
    genRandomSalt,
} from '../crypto/crypto'
import { genNewEpochTree, linkLibrary } from './utils'

chai.use(solidity)
const { expect } = chai

import PoseidonT3 from "../artifacts/PoseidonT3.json"
import PoseidonT6 from "../artifacts/PoseidonT6.json"
import OneTimeSparseMerkleTree from '../artifacts/OneTimeSparseMerkleTree.json'
import { NewSparseMerkleTreeImpl } from '../crypto/SMT/NewSparseMerkleTree'
import { epochTreeDepth } from '../config/testLocal'

/* Begin tests */
describe('OneTimeSparseMerkleTree', () => {
    let accounts: Signer[]

    const treeDepth = epochTreeDepth
    const defaultOTSMTHash = hashLeftRight(BigInt(1), BigInt(0))
    const numLeaves = BigNumber.from(1).shl(treeDepth)
    const sizeKeySpaceInBytes: number = Math.floor(treeDepth / 8)
    let OTSMTFactory: ContractFactory
    let tree: NewSparseMerkleTreeImpl

    beforeEach(async () => {
        let PoseidonT3Contract, PoseidonT6Contract
        accounts = await ethers.getSigners()

        console.log('Deploying PoseidonT3')
        PoseidonT3Contract = (await deployContract(
            <Wallet>accounts[0],
            PoseidonT3
        ))
        console.log('Deploying PoseidonT6')
        PoseidonT6Contract = (await deployContract(
            <Wallet>accounts[0],
            PoseidonT6,
            [],
            {
                gasLimit: 9000000,
            }
        ))

        // Link the library code if it has not been linked yet
        if(OneTimeSparseMerkleTree.bytecode.indexOf("$") > 0) {
            // Link the Unirep contract to PoseidonT3 contract
            linkLibrary(OneTimeSparseMerkleTree, 'contracts/Poseidon.sol:PoseidonT3', PoseidonT3Contract.address)
            // Link the Unirep contract to PoseidonT6 contract
            linkLibrary(OneTimeSparseMerkleTree, 'contracts/Poseidon.sol:PoseidonT6', PoseidonT6Contract.address)
        }

        OTSMTFactory = new ContractFactory(OneTimeSparseMerkleTree.abi, OneTimeSparseMerkleTree.bytecode, accounts[0])

        tree = await NewSparseMerkleTreeImpl.create(new Keyv(), treeDepth, defaultOTSMTHash)
    })

    describe('initialization ', async () => {
        it('default values should match', async () => {
            console.log('Deploying OneTimeSparseMerkleTree')
            let leafIndices: BigNumber[] = [BigNumber.from(1)]
            let leafHashes: BigInt[] = [BigInt(1)]
            const OneTimeSMT = await OTSMTFactory.deploy(
                treeDepth,
                leafIndices,
                leafHashes,
                {
                    gasLimit: 9000000,
                }
            )
            let receipt = await ethers.provider.getTransactionReceipt(OneTimeSMT.deployTransaction.hash)
            console.log("Gas cost of deploying OneTimeSparseMerkleTree with " + leafIndices.length + " leaves: " + receipt.gasUsed.toString())

            let numLeaves_ = (await OneTimeSMT.numLeaves())
            expect(numLeaves_).to.be.equal(tree.numLeaves)
            expect(numLeaves_).to.be.equal(numLeaves)

            let defaultHashes = await OneTimeSMT.getDefaultHashes()
            expect(defaultHashes.length).to.be.equal(treeDepth)
            let count = 0
            for(var hash of defaultHashes) {
                expect(hash).to.be.equal(tree.getZeroHash(count))
                count ++
            }
        })
    })

    describe('SMT ', async () => {
        it('verify merkle proof of adjacent indices', async () => {
            const numLeavesToInsert = Math.floor(Math.random() * 10 + 1)
            let leafIndices: BigNumber[] = []
            let leafHashes: BigInt[] = []
            let numKeyBytes = Math.floor(Math.random() * sizeKeySpaceInBytes + 1);
            let startIndex = BigNumber.from(crypto.randomBytes(numKeyBytes))
            for (let i = 0; i < numLeavesToInsert; i++) {
                leafIndices[i] = startIndex.add(i)
                leafHashes[i] = genRandomSalt()
            }

            for (let i = 0; i < numLeavesToInsert; i++) {
                await tree.update(leafIndices[i], leafHashes[i])
                const proof = await tree.getMerkleProof(leafIndices[i])
                const isProofValid = await  tree.verifyMerkleProof(leafIndices[i], proof)
                expect(isProofValid).to.be.true
            }
        })

        it('verify merkle proof of random indices', async () => {
            const numLeavesToInsert = Math.floor(Math.random() * 10 + 1)
            let leafIndices: BigNumber[] = []
            let leafHashes: BigInt[] = []
            let numKeyBytes: number
            for (let i = 0; i < numLeavesToInsert; i++) {
                numKeyBytes = Math.floor(Math.random() * sizeKeySpaceInBytes + 1)
                leafIndices[i] = BigNumber.from(crypto.randomBytes(numKeyBytes))
                leafHashes[i] = genRandomSalt()
            }

            for (let i = 0; i < numLeavesToInsert; i++) {
                await tree.update(leafIndices[i], leafHashes[i])
                const proof = await tree.getMerkleProof(leafIndices[i])
                const isProofValid = await  tree.verifyMerkleProof(leafIndices[i], proof)
                expect(isProofValid).to.be.true
            }
        })
    })

    describe('genSMT() ', async () => {
        it('inserting leaves with adjacent indices should match', async () => {
            const numLeavesToInsert = Math.floor(Math.random() * 10 + 1)
            let leafIndices: BigNumber[] = []
            let leafHashes: BigInt[] = []
            let numKeyBytes = Math.floor(Math.random() * sizeKeySpaceInBytes + 1);
            let startIndex = BigNumber.from(crypto.randomBytes(numKeyBytes))
            for (let i = 0; i < numLeavesToInsert; i++) {
                leafIndices[i] = startIndex.add(i)
                leafHashes[i] = genRandomSalt()
            }

            console.log('Deploying OneTimeSparseMerkleTree')
            const OneTimeSMT = await OTSMTFactory.deploy(
                treeDepth,
                leafIndices,
                leafHashes,
                {
                    gasLimit: 9000000,
                }
            )
            let receipt = await ethers.provider.getTransactionReceipt(OneTimeSMT.deployTransaction.hash)
            console.log("Gas cost of deploying OneTimeSparseMerkleTree with " + leafIndices.length + " leaves: " + receipt.gasUsed.toString())

            for (let i = 0; i < numLeavesToInsert; i++) {
                await tree.update(leafIndices[i], leafHashes[i])
            }
            let treeRoot = tree.getRootHash()

            const OTSMTRoot = await OneTimeSMT.genSMT()

            expect(OTSMTRoot).to.be.equal(treeRoot)
            console.log("Gas cost of computing the " + treeDepth + " level SMT with adjacent " + numLeavesToInsert + " indices " + receipt.gasUsed.toString())
        }).timeout(100000)

        it('inserting leaves with random indices should match', async () => {
            const numLeavesToInsert = 1
            // const numLeavesToInsert = Math.floor(Math.random() * 10 + 1)
            let leafIndices: BigNumber[] = []
            let leafHashes: BigInt[] = []
            let numKeyBytes: number
            for (let i = 0; i < numLeavesToInsert; i++) {
                numKeyBytes = Math.floor(Math.random() * sizeKeySpaceInBytes + 1)
                leafIndices[i] = BigNumber.from(crypto.randomBytes(numKeyBytes))
                leafHashes[i] = genRandomSalt()
            }

            console.log('Deploying OneTimeSparseMerkleTree')
            const OneTimeSMT = await OTSMTFactory.deploy(
                treeDepth,
                leafIndices,
                leafHashes,
                {
                    gasLimit: 9000000,
                }
            )
            let receipt = await ethers.provider.getTransactionReceipt(OneTimeSMT.deployTransaction.hash)
            console.log("Gas cost of deploying OneTimeSparseMerkleTree with " + leafIndices.length + " leaves: " + receipt.gasUsed.toString())

            for (let i = 0; i < numLeavesToInsert; i++) {
                await tree.update(leafIndices[i], leafHashes[i])
            }
            let treeRoot = tree.getRootHash()

            const OTSMTRoot = await OneTimeSMT.genSMT()

            expect(OTSMTRoot).to.be.equal(treeRoot)
            console.log("Gas cost of computing the " + treeDepth + " level SMT with random " + numLeavesToInsert + " indices " + receipt.gasUsed.toString())
        })

        it('inserting leaf with out of bound index should fail', async () => {
            let leafIndices = [numLeaves.add(1)]
            let leafHashes = [genRandomSalt()]

            console.log('Deploying OneTimeSparseMerkleTree which is expected to fail')
            await expect(OTSMTFactory.deploy(
                treeDepth,
                leafIndices,
                leafHashes,
                {
                    gasLimit: 9000000,
                }
            )).to.be.revertedWith('Index of inserted leaf is greater than total number of leaves')
        })
    })
})