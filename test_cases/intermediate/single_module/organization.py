from datetime import date
from typing import Optional


class Person:
    first_name: str
    last_name: str
    birth_date: date
    email: str
    phone: Optional[str]
    address: Optional[str]

    def __init__(
        self,
        first_name: str,
        last_name: str,
        birth_date: date,
        email: str,
        phone: Optional[str] = None,
        address: Optional[str] = None,
    ) -> None:
        self.first_name = first_name
        self.last_name = last_name
        self.birth_date = birth_date
        self.email = email
        self.phone = phone
        self.address = address

    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def age(self) -> int:
        today = date.today()
        return today.year - self.birth_date.year - (
            (today.month, today.day) < (self.birth_date.month, self.birth_date.day)
        )

    def initials(self) -> str:
        return f"{self.first_name[0]}.{self.last_name[0]}."


class Employee(Person):
    employee_id: str
    department: str
    hire_date: date
    salary: float
    is_full_time: bool
    benefits: list[str]

    def __init__(
        self,
        first_name: str,
        last_name: str,
        birth_date: date,
        email: str,
        employee_id: str,
        department: str,
        hire_date: date,
        salary: float,
        is_full_time: bool = True,
        phone: Optional[str] = None,
    ) -> None:
        super().__init__(first_name, last_name, birth_date, email, phone)
        self.employee_id = employee_id
        self.department = department
        self.hire_date = hire_date
        self.salary = salary
        self.is_full_time = is_full_time
        self.benefits = []

    def years_of_service(self) -> int:
        return date.today().year - self.hire_date.year

    def annual_cost(self) -> float:
        return self.salary * 12

    def add_benefit(self, benefit: str) -> None:
        if benefit not in self.benefits:
            self.benefits.append(benefit)


class Manager(Employee):
    team_members: list["Employee"]
    budget: float
    reports_to: Optional[str]
    performance_targets: dict[str, float]

    def __init__(
        self,
        first_name: str,
        last_name: str,
        birth_date: date,
        email: str,
        employee_id: str,
        department: str,
        hire_date: date,
        salary: float,
        budget: float,
        reports_to: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> None:
        super().__init__(
            first_name, last_name, birth_date, email,
            employee_id, department, hire_date, salary, phone=phone,
        )
        self.team_members = []
        self.budget = budget
        self.reports_to = reports_to
        self.performance_targets = {}

    def add_team_member(self, employee: "Employee") -> None:
        self.team_members.append(employee)

    def team_size(self) -> int:
        return len(self.team_members)

    def total_team_cost(self) -> float:
        return sum(e.annual_cost() for e in self.team_members)

    def set_target(self, metric: str, value: float) -> None:
        self.performance_targets[metric] = value


class Director(Manager):
    division: str
    kpis: dict[str, float]
    managed_departments: list[str]
    board_member: bool

    def __init__(
        self,
        first_name: str,
        last_name: str,
        birth_date: date,
        email: str,
        employee_id: str,
        department: str,
        hire_date: date,
        salary: float,
        budget: float,
        division: str,
        managed_departments: Optional[list[str]] = None,
        board_member: bool = False,
        phone: Optional[str] = None,
    ) -> None:
        super().__init__(
            first_name, last_name, birth_date, email,
            employee_id, department, hire_date, salary, budget, phone=phone,
        )
        self.division = division
        self.kpis = {}
        self.managed_departments = managed_departments or []
        self.board_member = board_member

    def set_kpi(self, name: str, target: float) -> None:
        self.kpis[name] = target

    def department_count(self) -> int:
        return len(self.managed_departments)

    def oversees(self, department: str) -> bool:
        return department in self.managed_departments
