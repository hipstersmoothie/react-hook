import * as React from 'react'

export const useAsync = <
  ValueType extends any = any,
  ErrorType extends any = Error,
  Args extends any[] = any[]
>(
  asyncCallback: (...args: Args) => Promise<ValueType>
): [AsyncState<ValueType, ErrorType, Args>, AsyncCallback<Args>] => {
  const [state, dispatch] = React.useReducer<
    React.Reducer<
      AsyncReducerState<ValueType, ErrorType, Args>,
      AsyncAction<ValueType, ErrorType>
    >,
    undefined
  >(
    (prev, action) => ({
      // This is the current status of the promise or async/await function. A
      // promise or async/await can only be in one state at a time.
      status: action.status,
      // The value is persisted between 'success' statuses. This means I can
      // still display things that depend on my current value while my new
      // value is loading.
      value: action.status === 'success' ? action.value : prev.value,
      // Errors get reset each time we leave the error state. There's really
      // no use in keeping those around. They go stale once we leave.
      error: action.status === 'error' ? action.error : void 0,
    }),
    void 0,
    () => {
      return {
        status: 'idle',
        value: void 0,
        error: void 0,
      }
    }
  )
  // Creates a stable callback that manages our loading/success/error status updates
  // as the callback is invoked.
  const storedCallback = React.useRef(asyncCallback)
  storedCallback.current = asyncCallback

  const [callback] = React.useState(() => {
    const cancelled: Set<Promise<ValueType> | null> = new Set()
    let previous: Promise<ValueType> | null

    return Object.assign(
      async (...args: Args) => {
        // Reloading automatically cancels previous promises
        cancelled.add(previous)
        dispatch({status: 'loading'})
        let current: Promise<ValueType> | null = null

        try {
          previous = current = storedCallback.current(...args)
          const value = await current
          !cancelled.has(current) && dispatch({status: 'success', value})
        } catch (error) {
          current &&
            !cancelled.has(current) &&
            dispatch({status: 'error', error})
        } finally {
          cancelled.delete(current)
        }
      },
      {
        cancel: () => {
          cancelled.add(previous)
        },
      }
    )
  })

  // Cancels any pending async callbacks when the hook unmounts
  React.useEffect(() => callback.cancel, [callback])

  return [
    React.useMemo(() => {
      return {
        status: state.status,
        value: state.value,
        error: state.error,
        cancel: () => {
          // Prevent the callback from dispatching
          callback.cancel()
          // Create a new callback and set status to cancelled
          dispatch({status: 'cancelled'})
        },
      }
    }, [callback, state]),
    callback,
  ]
}

export const useAsyncEffect = <
  ValueType extends any = any,
  ErrorType extends any = Error
>(
  asyncCallback: () => Promise<ValueType>,
  dependencies?: React.DependencyList
): AsyncState<ValueType, ErrorType, []> => {
  const [state, callback] = useAsync<ValueType, ErrorType>(asyncCallback)
  // Runs the callback each time deps change
  React.useEffect(() => {
    callback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  return state
}

export interface AsyncReducerState<
  ValueType,
  ErrorType,
  Args extends any[] = any[]
> {
  status: AsyncStatus
  value?: ValueType
  error?: ErrorType
}

export interface AsyncState<ValueType, ErrorType, Args extends any[] = any[]>
  extends AsyncReducerState<ValueType, ErrorType, Args> {
  cancel: () => void
}

export type AsyncAction<ValueType, ErrorType> =
  | {
      status: 'idle' | 'loading' | 'cancelled'
    }
  | {
      status: 'success'
      value: ValueType
    }
  | {
      status: 'error'
      error?: ErrorType
    }

export interface AsyncCallback<Args extends any[] = any[]> {
  (...args: Args): void
  cancel: () => void
}

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error' | 'cancelled'
