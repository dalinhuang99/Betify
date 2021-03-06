// moment js
var moment = require('moment')

// ===============================================================================
// Binance API / webSocket
module.exports = function(models,clients){

  const binance = require('node-binance-api')().options({
    APIKEY: '<key>',
    APISECRET: '<secret>',
    useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
    test: false // If you want to use sandbox mode where orders are simulated
  })

  // --------- BTCUSDT ---------
  const BTCUSDT_20 = 10;

  var Btcusdt = models.btcusdt_table;

  var initTimer = new Date().getTime() + BTCUSDT_20*1000;
  var thisGameId = Math.round(initTimer/1000);
  var nextGameId = thisGameId+BTCUSDT_20;
  var gameStartBtcPrice = 0;
  var gameEndBtcPrice = 0;

  // For a specific symbol:
  binance.websockets.prevDay('BTCUSDT', (error, response) => {
    // var t = new Date( response.eventTime );
    // var formatted = t.format("dd.mm.yyyy hh:MM:ss");
    if (error) throw error

    // console.log(response);

    // save to database
    if (response.symbol &&
        response.close &&
        response.closeTime &&
        response.eventTime
    ) {
      let closeTime = moment(response.closeTime).format('HH:mm:ss')
      let closePrice = +response.close
      let eventTime = response.eventTime
      // count down before next game
      let nextBetCountDown = thisGameId*1000 - eventTime;

      // game loop counter
      if (thisGameId*1000 <= eventTime) {
        gameEndBtcPrice = closePrice;

        let price_dif = (gameEndBtcPrice - gameStartBtcPrice).toFixed(8);
        let new_gameId = thisGameId;

        Btcusdt.create({
          exchange_name: 'Binance',
          symbol: response.symbol,
          game_id: new_gameId,
          start_price: gameStartBtcPrice,
          close_price: gameEndBtcPrice,
          price_diff: price_dif,
          close_time: response.closeTime
        }).then(btcusdt => {

          thisGameId = nextGameId;
          nextGameId = nextGameId+BTCUSDT_20;

          broadcast('BET', closePrice, nextBetCountDown, gameStartBtcPrice, gameEndBtcPrice, price_dif, thisGameId, nextGameId)

          // new game started
          gameStartBtcPrice = closePrice;
        })

      } else {
        broadcast('', closePrice, nextBetCountDown, gameStartBtcPrice, gameEndBtcPrice, '', thisGameId, nextGameId)
      }
    }
  })

  // Every three seconds broadcast "{ message: 'Hello hello!' }" to all connected clients
  var broadcast = function (time, close, nextBetCountDown, startBtcPrice, endBtcPrice, priceDif, thisGameId, nextGameId) {
    var json = JSON.stringify({
      eventTime: time,
      close: close,
      nextBetCountDown: nextBetCountDown,
      startBtcPrice: startBtcPrice,
      endBtcPrice: endBtcPrice,
      priceDif: priceDif,
      thisGameId: thisGameId,
      nextGameId: nextGameId
    })

    console.log('json----' + json);

    clients.forEach(function (stream) {
      stream.send(json)
      // console.log('Sent: ' + json);
    })
  }

}
