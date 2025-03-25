import '!prismjs/themes/prism.css'

import {
  Button,
  Container,
  render,
  VerticalSpace
} from '@create-figma-plugin/ui'
import { emit, on } from '@create-figma-plugin/utilities'
import { h, RefObject } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'


import '!./output.css'
import { InsertCodeHandler } from './types'


function Plugin() {
  const [json, setJson] = useState('')
  const containerElementRef : RefObject<HTMLDivElement> = useRef(null)
  const handleInsertCodeButtonClick = useCallback(
    function () {
      emit('RUN')
      // emit<InsertCodeHandler>('INSERT_CODE', 'code')
    },
    []
  )

  useEffect(function () {
    on('display-json', function (json) {
      setJson(json)
    })
  }, [])
  // Patch to make `react-simple-code-editor` compatible with Preact
  // useEffect(function () {
  //   const containerElement = containerElementRef.current
  //   if (containerElement === null) {
  //     return
  //   }
  //   const textAreaElement = containerElement.querySelector('textarea')
  //   if (textAreaElement === null) {
  //     return
  //   }
  //   textAreaElement.textContent = code
  //   const preElement = containerElement.querySelector('pre')
  //   if (preElement === null) {
  //     return
  //   }
  //   if (textAreaElement.nextElementSibling !== preElement) {
  //     textAreaElement.after(preElement)
  //   }
  // }, [])


  return (
      <div class="flex flex-col h-full p-4">
      <div class="bg-stone-100 dark:bg-stone-700 rounded-lg p-2 w-full h-full overflow-auto ">
        {json ? (
          <pre>
            {json}
          </pre>
        ) : (
          <div class="flex flex-col h-full w-full justify-center items-center">
            <p class="text-stone-500 dark:text-stone-400">No JSON data</p>
          </div>
        )}
      </div>
      <VerticalSpace space="large" />
      <Button fullWidth onClick={handleInsertCodeButtonClick}>
        Run
      </Button>
      </div>
  )
}

export default render(Plugin)
