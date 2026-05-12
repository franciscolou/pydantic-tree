import abc

class ABCBase(metaclass=abc.ABCMeta):
    x: int
    y: int
    z: int


    @abc.abstractmethod
    def abstract_method(num1: int, num2: int) -> int: ...

    def concrete_method(string: str) -> str:
        return "wow"
    

class Implementation(ABCBase):
    pass