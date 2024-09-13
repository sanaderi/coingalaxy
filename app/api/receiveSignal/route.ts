import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '../../../lib/mongodb'
import { error } from 'console'

export async function POST(request: NextRequest) {
  try {
    // Define the allowed IP addresses
    const allowedIPs = [
      // '::1',//For allow localhost
      '52.89.214.238',
      '34.212.75.30',
      '54.218.53.128',
      '52.32.178.7'
    ]

    // Get the IP address from the request headers
    const requestIP = request.headers.get('x-forwarded-for') || request.ip || ''

    // If there are multiple IPs (proxy), take the first one
    const ip = requestIP.split(',')[0].trim()

    // Check if the request IP matches any of the allowed IPs
    // if (!allowedIPs.includes(ip)) {
    //   return NextResponse.json(
    //     { error: 'Access denied: Your IP is not allowed.' },
    //     { status: 403 }
    //   )
    // }

    // Parse the incoming request body as JSON
    const body = await request.json()

    // Validate the data (optional)
    if (!body) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    // Connect to MongoDB
    const client = await clientPromise
    const db = client.db('coingalaxy')
    const collection = db.collection('signal_status')

    // Insert the data into MongoDB
    const firstDoc = await collection.findOne({}, { sort: { _id: 1 } })

    interface DataObject {
      signal?: string
      time?: number
      confirm?: string
    }

    let dataObject: DataObject = {}
    if (body.type === 'sell') {
      if (body.value == 'signal' && firstDoc && firstDoc.confirm == 'sell') {
        dataObject.signal = 'sell'
        dataObject.time = Math.floor(Date.now() / 1000)
      } else if (body.value == 'mild' || body.value == 'divergence')
        dataObject.confirm = 'sell'
    } else if (body.type === 'buy') {
      if (body.value == 'signal' && firstDoc && firstDoc.confirm == 'buy') {
        dataObject.signal = 'buy'
        dataObject.time = Math.floor(Date.now() / 1000)
      } else if (body.value == 'mild' || body.value == 'divergence')
        dataObject.confirm = 'buy'
    }

    if (!dataObject)
      return NextResponse.json(
        { error: 'Uknown data', data: dataObject },
        { status: 500 }
      )

    if (firstDoc) {
      const id = firstDoc._id

      // Update the existing document
      const update = { $set: { ...dataObject } }
      const result = await collection.findOneAndUpdate({ _id: id }, update, {
        returnDocument: 'after'
      })
    } else {
      // No document exists, insert a new one
      const insertResult = await collection.insertOne({
        ...dataObject,
        time: Math.floor(Date.now() / 1000)
      })
    }
    // Return a success response
    return NextResponse.json({
      message: 'Data saved successfully',
      data: dataObject
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 })
  }
}
