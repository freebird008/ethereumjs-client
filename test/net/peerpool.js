const tape = require('tape-catch')
const td = require('testdouble')
const EventEmitter = require('events')
const { defaultLogger } = require('../../lib/logging')
defaultLogger.silent = true

tape('[PeerPool]', t => {
  const Peer = td.replace('../../lib/net/peer/peer', function (id) { this.id = id })
  const PeerPool = require('../../lib/net/peerpool')

  t.test('should initialize', t => {
    const pool = new PeerPool()
    t.notOk(pool.pool.length, 'empty pool')
    t.notOk(pool.opened, 'not open')
    t.end()
  })

  t.test('should open/close', async (t) => {
    const server = new EventEmitter()
    const pool = new PeerPool({servers: [server]})
    pool.connected = td.func()
    pool.disconnected = td.func()
    await pool.open()
    server.emit('connected', 'peer')
    server.emit('disconnected', 'peer')
    process.nextTick(() => {
      td.verify(pool.connected('peer'))
      td.verify(pool.disconnected('peer'))
    })
    t.equals(await pool.open(), false, 'already opened')
    await pool.close()
    t.notOk(pool.opened, 'closed')
    t.end()
  })

  t.test('should connect/disconnect peer', t => {
    t.plan(4)
    const peer = new EventEmitter()
    const pool = new PeerPool()
    peer.id = 'abc'
    pool.ban = td.func()
    pool.connected(peer)
    pool.on('message', (msg, proto, p) => {
      t.ok(msg === 'msg0' && proto === 'proto0' && p === peer, 'got message')
    })
    pool.on('message:proto0', (msg, p) => {
      t.ok(msg === 'msg0' && p === peer, 'got message:protocol')
    })
    peer.emit('message', 'msg0', 'proto0')
    peer.emit('error', 'err0', 'proto0')
    process.nextTick(() => {
      td.verify(pool.ban(peer))
      t.pass('got error')
    })
    pool.disconnected(peer)
    t.notOk(pool.pool.get('abc'), 'peer removed')
  })

  t.test('should check contains', t => {
    const peer = new Peer('abc')
    const pool = new PeerPool()
    pool.add(peer)
    t.ok(pool.contains(peer), 'found peer')
    t.end()
  })

  t.test('should get idle peers', t => {
    const peers = [new Peer(1), new Peer(2), new Peer(3)]
    const pool = new PeerPool()
    peers[1].idle = true
    peers.forEach(p => pool.add(p))
    t.equals(pool.idle(), peers[1], 'correct idle peer')
    t.equals(pool.idle((p) => p.id > 1), peers[1], 'correct idle peer with filter')
    t.end()
  })

  t.test('should ban peer', t => {
    const peers = [{id: 1}, {id: 2, server: { ban: td.func() }}]
    const pool = new PeerPool()
    peers.forEach(p => pool.add(p))
    peers.forEach(p => pool.ban(p, 1000))
    pool.on('banned', peer => td.equals(peer, peers[1], 'banned peer'))
    pool.on('removed', peer => td.equals(peer, peers[1], 'removed peer'))
    t.equals(pool.peers[0], peers[0], 'outbound peer not banned')
    t.end()
  })

  t.test('should reset td', t => {
    td.reset()
    t.end()
  })
})
