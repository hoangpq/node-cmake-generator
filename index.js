const path = require('path')
const {spawn} = require('child_process')
const fs = require('fs')
const readline = require('readline')

module.exports = {generateCMakeLists}

async function generateCMakeLists(nodeDir, pythonPath, cmakeConfig, skipConfigure, skipGyp) {
  if (!skipConfigure) {
    await configure(nodeDir)
  }

  if (!skipGyp) {
    await gypNode(nodeDir, pythonPath)
  }

  return deployLists(nodeDir, cmakeConfig)
}

function configure(nodeDir) {
  return new Promise((resolve, reject) => {
    const configure = spawn(path.join(nodeDir, 'configure', '--openssl-no-asm'), {stdio: 'inherit'})

    configure.on('close', code => {
      if (code) {
        reject(`configure exited with code ${code}`)
      } else {
        resolve()
      }
    })

    configure.on('error', (err) => {
      console.error(err.toString())
      reject('configure failed')
    })
  })
}

function gypNode(nodeDir, pythonPath) {
  return new Promise((resolve, reject) => {
    const gypNode = spawn(pythonPath, [path.join(nodeDir, 'tools', 'gyp_node.py'), '-f', 'cmake'], {stdio: 'inherit'})

    gypNode.on('close', code => {
      if (code) {
        reject(`gyp_node.py exited with code ${code}`)
      } else {
        resolve()
      }
    })

    gypNode.on('error', (err) => {
      console.error(err.toString())
      reject('gyp_node.py failed')
    })
  })
}

function deployLists(nodeDir, cmakeConfig) {
  const cmakeListsDir = path.join(nodeDir, 'out')
  const cmakeListsPath = path.join(cmakeListsDir, cmakeConfig, 'CMakeLists.txt')

  const readFile = readline.createInterface({
    input: fs.createReadStream(cmakeListsPath),
    output: fs.createWriteStream(path.join(nodeDir, 'CMakeLists.txt')),
    terminal: false
  })

  function fixLine(line) {
    line = line.replace(/--whole-archive/g, '-all_load')
    line = line.replace(/--no-whole-archive/g, '-noall_load')
    line = line.replace('"../../', '"')
    line = line.replace('${CMAKE_CURRENT_LIST_DIR}/../..', '${CMAKE_CURRENT_LIST_DIR}')
    line = line.replace('  "src/tracing/trace_event.hsrc/util.h"\n', '  "src/tracing/trace_event.h"\n  "src/util.h"\n')
    line = line.replace('"deps/include/v8-inspector.h"', '"deps/v8/include/v8-inspector.h"')
    line = line.replace('"deps/include/v8-inspector-protocol.h"', '"deps/v8/include/v8-inspector-protocol.h"')
    line = line.replace('"${builddir}/obj.target/node/gen', '"${builddir}/CMakeFiles/node.dir/obj/gen')
    line = line.replace('"${builddir}/obj.target/node', '"${builddir}/CMakeFiles/node.dir')
    this.output.write(`${line}\n`)
  }

  return new Promise(resolve => {
    readFile
      .on('line', fixLine)
      .on('close', resolve)
  })
}
