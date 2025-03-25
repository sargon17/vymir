import '!prismjs/themes/prism.css'

import {
  Button,
  Container,
  render,
  VerticalSpace
} from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import { h, RefObject } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'


import '!./output.css'
import { InsertCodeHandler } from './types'


function Plugin() {
  const containerElementRef : RefObject<HTMLDivElement> = useRef(null)
  const handleInsertCodeButtonClick = useCallback(
    function () {
      console.log('insert code')
      // emit<InsertCodeHandler>('INSERT_CODE', 'code')
    },
    []
  )
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
    <Container space="medium">
      <VerticalSpace space="small" />
      <div ref={containerElementRef}>
      </div>
      <div class="bg-red-400 w-full h-10">
        this should be a red box
      </div>
      <VerticalSpace space="large" />
      <Button fullWidth onClick={handleInsertCodeButtonClick}>
        Run
      </Button>
      <VerticalSpace space="small" />
    </Container>
  )
}

export default render(Plugin)
