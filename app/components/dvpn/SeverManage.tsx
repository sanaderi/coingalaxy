'use client'
import { z } from 'zod'
import { getProgram } from '../../../utils/createPlan' // Adjust the path as needed

import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { BN, web3 } from '@project-serum/anchor' // Import BN
import { PublicKey } from '@solana/web3.js'

import { useEffect, useState, useCallback, useRef } from 'react'
import { AnchorProvider, AnchorError, Wallet } from '@coral-xyz/anchor'
import { formatUTCDate } from '@/utils/formatUTCDate'
import { fetchJupiterPrice } from '@/lib/jupiter'
interface UsrPlans {
  owner: string
  expirationDate: string
  publicKey: string
}
export default function SubscribeCard() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()

  const [isLoading, setIsLoading] = useState(false)
  const [activeServers, setactiveServers] = useState<Array<UsrPlans>>([])
  const [solPrice, setPriceData] = useState(0)

  const dialogRef = useRef(null)

  useEffect(() => {
    async function getPrice() {
      const data = await fetchJupiterPrice('SOL') // Fetch SOL price as an example
      setPriceData(data.data.SOL.price)
    }

    getPrice()
  }, [])

  const handleSubmitServer = async (expirationDate: number) => {
    try {
      const program = getProgram()
      const provider = program.provider as AnchorProvider

      // Generate a new keypair for the plan
      const plan = web3.Keypair.generate()

      // Create the PublicKey object using the buffer
      const SOL_PRICE_FEED_ID = new PublicKey(
        '7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE'
      )

      // Derive the PDA using the same seed
      const [pdaPublicKey, bump] = await PublicKey.findProgramAddressSync(
        [Buffer.from('payment')], // Ensure this matches the seed in your Rust program
        program.programId
      )

      // Call the `createPlan` instruction defined in the IDL
      await program.rpc.submitServer(new BN(expirationDate), {
        accounts: {
          plan: plan.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
          priceUpdate: SOL_PRICE_FEED_ID,
          pdaAccount: pdaPublicKey
        },
        signers: [plan]
      })
      getPlanDetails(plan.publicKey.toBase58())
    } catch (err) {
      if (err instanceof AnchorError) {
        console.error('AnchorError:', err)
        console.error('Error Details:', err.error.errorMessage)
      } else {
        console.error('TransactionError:', err)
      }
    }
  }

  const getPlansByUser = useCallback(async (userPublicKey: PublicKey) => {
    const program = getProgram()

    try {
      // Fetch all accounts for the program where the owner is the user's public key
      const accounts = await connection.getProgramAccounts(program.programId, {
        filters: [
          {
            memcmp: {
              offset: 8, // Adjust based on where the owner field is in the Plan struct
              bytes: userPublicKey.toBase58()
            }
          }
        ]
      })

      // Decode each account data to get the plan details
      const plans = accounts.map((account) => {
        const planData = program.account.plan.coder.accounts.decode(
          'Plan',
          account.account.data
        )
        return {
          publicKey: account.pubkey, // Access and return the publicKey as a string
          ...planData // Spread the decoded plan data into the object
        }
      })

      console.log(plans)

      setactiveServers(plans)
    } catch (error) {
      console.error('Failed to fetch plans for user:', error)
    }
  }, [])

  useEffect(() => {
    if (publicKey) {
      getPlansByUser(publicKey)
    }
  }, [publicKey, getPlansByUser])

  const getPlanDetails = async (key: string) => {
    const planPublicKey = new PublicKey(key)
    const program = getProgram()

    try {
      // Fetch the Plan account details using its public key
      const planDetails = await program.account.plan.fetch(planPublicKey)

      console.log('Plan Details:', planDetails)
      console.log('Number:', planDetails.expirationDate.toNumber())

      return planDetails
    } catch (error) {
      console.error('Failed to fetch plan details:', error)
    }
  }

  return (
    <div>
      <div className="container">
        <div className="mt-8">
          <div>
            <div>
              <div className="flow-root"></div>

              <div>
                {publicKey ? (
                  <div className="w-full mb-10 mx-auto px-4">
                    <h1 className="text-2xl font-bold text-center mb-6">
                      Submit your server
                    </h1>
                    <div className="w-full flex flex-col xs:flex-col md:flex-row gap-4 justify-center items-center">
                      <input
                        type="text"
                        placeholder="IP Address"
                        className="input input-bordered w-full md:max-w-xs"
                      />
                      <input
                        type="text"
                        placeholder="Port"
                        className="input input-bordered w-full md:max-w-20"
                      />
                      <select className="select select-bordered w-full md:max-w-40">
                        <option>SSH Tunnel</option>
                      </select>
                      <button
                        onClick={() => handleSubmitServer}
                        className="btn btn-primary w-full md:max-w-40"
                      >
                        Submit
                      </button>
                    </div>

                    <h1 className="text-2xl font-bold text-center mt-16 mb-8">
                      Your plans
                    </h1>
                    {activeServers.length === 0 ? (
                      <p className="text-center">No plans found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full lg:w-1/2 table-auto mx-auto mb-14">
                          <thead>
                            <tr>
                              <th className="text-left">IP Address</th>
                              <th className="text-left">Port</th>
                              <th className="text-left">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeServers.map((plan, index) => (
                              <tr key={index}>
                                <td className="py-1">
                                  {plan.publicKey.toString()}
                                </td>
                                <td>
                                  {formatUTCDate(
                                    plan.expirationDate.toString()
                                  )}
                                </td>
                                <td>SSH Tunnel</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <h1 className="text-center">Wallet is not connected</h1>
                )}
              </div>

              <dialog
                ref={dialogRef}
                className="modal"
              >
                <div className="modal-box">
                  <h3 className="text-lg font-bold">Server config</h3>
                  <p className="py-4">
                    This section is under development (Generate random user,
                    pass for random server is stored in account creation
                    proccess and set in destination server (if exists delete and
                    recreate username)) for change server need to new sign
                    transaction , Press ESC key or click the button below to
                    close
                  </p>
                  <div className="modal-action">
                    <form method="dialog">
                      <button className="btn">Close</button>
                    </form>
                  </div>
                </div>
              </dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
