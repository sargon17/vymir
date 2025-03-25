import '!prismjs/themes/prism.css'

import {
  Button,
  render,
  VerticalSpace
} from '@create-figma-plugin/ui'
import { emit, on } from '@create-figma-plugin/utilities'
import { h } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'

import '!./output.css'



function Plugin() {
  const [json, setJson] = useState('')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const handleInsertCodeButtonClick = useCallback(
    function () {
      emit('get-variables')
    },
    []
  )



  const copyToClipboard = (text: string) => {
    let textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }

  const handleCopyToClipboardButtonClick = useCallback(
    function () {
      try {
        copyToClipboard(json) 
        emit('notify', 'Copied to clipboard', {
          error: false
        })
        setTimeout(() => setCopyStatus('idle'), 2000)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
        emit('notify', 'Failed to copy to clipboard', {
          error: true
        })
        setTimeout(() => setCopyStatus('idle'), 2000)

      }
    },
    [json]
  )


  on('display-json', function (json) {
    setJson(json)
  })

  // useEffect(function () {
  //   handleInsertCodeButtonClick()
  // }, [])

  return (
      <div class="flex flex-col h-full p-4 gap-4">
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
      <div class="flex gap-2 justify-end">
      {json && (
        <Button
        secondary
        onClick={handleCopyToClipboardButtonClick}
        >
          Copy to Clipboard
        </Button>
      )}
      <Button onClick={handleInsertCodeButtonClick}>
        Generate JSON
      </Button>
      </div>
      </div>
  )
}

export default render(Plugin)
