import inspect
import typing

if hasattr(typing, 'ForwardRef'):
    _forward_ref = typing.ForwardRef
    signature = inspect.signature(_forward_ref._evaluate)
    if 'recursive_guard' in signature.parameters:
        _original_evaluate = _forward_ref._evaluate

        def _evaluate(self, globalns, localns, *args, **kwargs):
            if args:
                type_params, *args = args
            else:
                type_params = None

            if 'recursive_guard' in kwargs:
                recursive_guard = kwargs.pop('recursive_guard')
            elif args:
                recursive_guard = args[0]
            else:
                recursive_guard = set()

            return _original_evaluate(self, globalns, localns, type_params, recursive_guard=recursive_guard)

        _forward_ref._evaluate = _evaluate  # type: ignore[assignment]
