// Work in progress...
self.onmessage = function (e) {
  const { bufferX, bufferY, outputBufferX, outputBufferY } = e.data

  const arrayX = new Float64Array(bufferX)
  const arrayY = new Float32Array(bufferY)
  const outputArrayX = new Float64Array(outputBufferX)
  const outputArrayY = new Float32Array(outputBufferY)

  self.postMessage('Done')
}
