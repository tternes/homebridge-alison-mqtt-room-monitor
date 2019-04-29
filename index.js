var http = require('http')
var mqtt = require('mqtt')
var Service, Characteristic
var pkginfo = require('./package.json')

module.exports = function(homebridge) {
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    homebridge.registerAccessory("homebridge-alison-mqtt-room-monitor", "Alison Room Monitor", AlisonRoomMonitor)
}


function AlisonRoomMonitor(log, config) {
  var boardId = config.boardId || 'unknown'
  var manufacturer = config.manufacturer || 'Evening Indie'
  var model = config.model || 'Alison Room Monitor'
  var firmwareVersion = pkginfo.version || '0.0.0'
  
  this.log = log
  this.config = config
  this.name = config.name
  this.statusTopic = `/alison/esp8266/${boardId}/status`
  
  this.currentTemperature = 0.0
  this.currentHumidity = 0.0
  
  this.infoService = new Service.AccessoryInformation()
  this.infoService
    .setCharacteristic(Characteristic.Manufacturer, manufacturer)
    .setCharacteristic(Characteristic.Model, model)
    .setCharacteristic(Characteristic.SerialNumber, boardId)
    .setCharacteristic(Characteristic.FirmwareRevision, firmwareVersion)

  this.temperatureService = new Service.TemperatureSensor(this.name)
  this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature)
    .on('get', this.getCurrentTemperature.bind(this))
  
  this.humidityService = new Service.HumiditySensor(this.name)
  this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
    .on('get', this.getCurrentHumidity.bind(this))

  this.log(`connecting to ${config.url}`)
  this.mqclient = mqtt.connect(config.url)
  
  this.mqclient.on('connect', this.onMqttConnected.bind(this))
  this.mqclient.on('reconnect', this.onMqttReconnected.bind(this))
  this.mqclient.on('message', this.onMqttMessage.bind(this))
}


AlisonRoomMonitor.prototype.onMqttConnected = function () {
  this.log(`mqtt client connected, subscribing to ${this.statusTopic}`)
  this.mqclient.subscribe(this.statusTopic)
}


AlisonRoomMonitor.prototype.onMqttReconnected = function() {
  this.log('mqtt client reconnected')
}


AlisonRoomMonitor.prototype.onMqttMessage = function (topic, message) {
  try {
    var status = JSON.parse(message)
    if(status.c != null) {
      this.updateCurrentTemperature(status.c)
    }
    if(status.h != null) {
      this.updateCurrentHumidity(status.h)
    }
  }
  catch(e) {
    console.log(`Failed to parse message: ${message}`)
    console.log(e)
  }
  
}


AlisonRoomMonitor.prototype.getCurrentTemperature = function(callback) {
  callback(null, this.currentTemperature)
}


AlisonRoomMonitor.prototype.updateCurrentTemperature = function(degrees) {
  if(this.currentTemperature != degrees) {
    this.log(`updating current temperature ${this.currentTemperature} => ${degrees}`)
    this.currentTemperature = degrees
    var c = this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature)
    c.getValue()    
  }
}


AlisonRoomMonitor.prototype.getCurrentHumidity = function(callback) {
  callback(null, this.currentHumidity)
}


AlisonRoomMonitor.prototype.updateCurrentHumidity = function(humidity) {
  if(this.currentHumidity != humidity) {
    this.log(`updating current humidity ${this.currentHumidity} => ${humidity}`)
    this.currentHumidity = humidity
    var c = this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
    c.getValue()    
  }
}


AlisonRoomMonitor.prototype.getServices = function() {
  return [
    this.temperatureService,
    this.humidityService,
    this.infoService
  ]
}
